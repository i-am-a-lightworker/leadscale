import { z } from "zod";
import { filterLead } from "../filtering/leadFilter";
import {
  AssessmentSchema,
  LeadSchema,
  type Lead,
  type PrioritizedLead,
} from "../types/lead";
import { deriveMissingInformation, scoreLead } from "./scoring";
import { buildFallbackAssessment } from "./fallback";
import { runLeadAgent, type AgentInput, type ModelRunner } from "./agent";
import { validateAndConstrain } from "./validateAssessment";

export const AGENT_PROMPT_VERSION = "1.0.0";

export const PRIORITIZE_CONFIG = {
  defaultTimeoutMs: 15000,
  defaultConcurrency: 3,
  retries: 1,
} as const;

export const PrioritizedLeadSchema = z.object({
  lead: LeadSchema,
  assessment: AssessmentSchema,
}).strict();

const RejectedLeadSchema = z.object({ lead: LeadSchema, reasons: z.array(z.string().min(1)) }).strict();
const PrioritizeMetaSchema = z.object({
  leadId: z.string(),
  source: z.enum(["agent", "fallback"]),
  retries: z.number().int().nonnegative(),
  adjustments: z.array(z.string()),
  flags: z.array(z.string()),
  durationMs: z.number().nonnegative(),
  promptVersion: z.string(),
}).strict();

export const PrioritizeResultSchema = z.object({
  ranked: z.array(PrioritizedLeadSchema),
  rejected: z.array(RejectedLeadSchema),
  meta: z.array(PrioritizeMetaSchema),
}).strict();

export type PrioritizeMeta = z.infer<typeof PrioritizeMetaSchema>;
export type PrioritizeResult = z.infer<typeof PrioritizeResultSchema>;

export type PrioritizeDependencies = {
  modelRunner: ModelRunner;
  filterBatch?: readonly Lead[];
  timeoutMs?: number;
  concurrency?: number;
  now?: string;
};

type PerLeadResult =
  | { kind: "rejected"; lead: Lead; reasons: string[] }
  | { kind: "prioritized"; value: PrioritizedLead; meta: PrioritizeMeta };

class AgentTimeoutError extends Error {
  constructor() {
    super("Agent invocation timed out.");
    this.name = "AgentTimeoutError";
  }
}

async function withTimeout<T>(task: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AgentTimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function validateRuntimeLimit(value: number | undefined, fallback: number, name: string): number {
  const limit = value ?? fallback;
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`${name} must be a positive integer.`);
  return limit;
}

async function prioritizeOne(
  lead: Lead,
  allLeads: readonly Lead[],
  dependencies: PrioritizeDependencies,
  timeoutMs: number,
): Promise<PerLeadResult> {
  const startedAt = Date.now();
  const filterBatch = dependencies.filterBatch ?? allLeads;
  const filtered = filterLead(lead, { now: dependencies.now ?? new Date().toISOString(), batch: filterBatch });
  if (filtered.status === "rejected") return { kind: "rejected", lead, reasons: filtered.reasons };

  const flags = filtered.status === "flagged" ? filtered.flags : [];
  const scoring = scoreLead(lead, flags);
  const agentInput: Omit<AgentInput, "signal" | "repairInstruction"> = {
    leadId: lead.id,
    preScore: scoring.score,
    breakdown: scoring.breakdown,
    flags,
    missingInformation: deriveMissingInformation(lead),
  };

  for (let retries = 0; retries <= PRIORITIZE_CONFIG.retries; retries += 1) {
    try {
      const raw = await withTimeout(
        (signal) => runLeadAgent({
          ...agentInput,
          signal,
          ...(retries > 0 ? { repairInstruction: "Your previous response failed validation. Return corrected Assessment JSON only, respecting all constraints." } : {}),
        }, dependencies.modelRunner),
        timeoutMs,
      );
      const validated = validateAndConstrain(raw, scoring.score, lead, flags, scoring.breakdown);
      return {
        kind: "prioritized",
        value: { lead, assessment: validated.assessment },
        meta: {
          leadId: lead.id,
          source: "agent",
          retries,
          adjustments: validated.adjustments,
          flags,
          durationMs: Math.max(0, Date.now() - startedAt),
          promptVersion: AGENT_PROMPT_VERSION,
        },
      };
    } catch {
      if (retries === PRIORITIZE_CONFIG.retries) {
        const assessment = buildFallbackAssessment(lead, scoring.score, scoring.breakdown, flags);
        return {
          kind: "prioritized",
          value: { lead, assessment },
          meta: {
            leadId: lead.id,
            source: "fallback",
            retries,
            adjustments: ["Deterministic fallback used after model failure or invalid output."],
            flags,
            durationMs: Math.max(0, Date.now() - startedAt),
            promptVersion: AGENT_PROMPT_VERSION,
          },
        };
      }
    }
  }

  throw new Error("Unreachable lead-prioritization state.");
}

export async function prioritizeLeads(
  leads: readonly Lead[],
  dependencies: PrioritizeDependencies,
): Promise<PrioritizeResult> {
  const timeoutMs = validateRuntimeLimit(dependencies.timeoutMs, PRIORITIZE_CONFIG.defaultTimeoutMs, "timeoutMs");
  const concurrency = validateRuntimeLimit(dependencies.concurrency, PRIORITIZE_CONFIG.defaultConcurrency, "concurrency");
  const outcomes: (PerLeadResult | undefined)[] = Array.from({ length: leads.length });
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      const lead = leads[index];
      if (!lead) return;
      try {
        outcomes[index] = await prioritizeOne(lead, leads, dependencies, timeoutMs);
      } catch {
        const fallbackFiltered = filterLead(lead, {
          now: dependencies.now ?? new Date().toISOString(),
          batch: dependencies.filterBatch ?? leads,
        });
        if (fallbackFiltered.status === "rejected") {
          outcomes[index] = { kind: "rejected", lead, reasons: fallbackFiltered.reasons };
          return;
        }
        const flags = fallbackFiltered.status === "flagged" ? fallbackFiltered.flags : [];
        const scoring = scoreLead(lead, flags);
        outcomes[index] = {
          kind: "prioritized",
          value: { lead, assessment: buildFallbackAssessment(lead, scoring.score, scoring.breakdown, flags) },
          meta: {
            leadId: lead.id,
            source: "fallback",
            retries: PRIORITIZE_CONFIG.retries,
            adjustments: ["Deterministic fallback used after an unexpected lead-processing error."],
            flags,
            durationMs: 0,
            promptVersion: AGENT_PROMPT_VERSION,
          },
        };
      }
    }
  }

  const workerCount = Math.min(concurrency, leads.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const completed = outcomes.filter((outcome): outcome is PerLeadResult => outcome !== undefined);
  const ranked = completed
    .filter((outcome): outcome is Extract<PerLeadResult, { kind: "prioritized" }> => outcome.kind === "prioritized")
    .map((outcome) => outcome.value)
    .sort((left, right) =>
      right.assessment.score - left.assessment.score ||
      Date.parse(right.lead.receivedAt) - Date.parse(left.lead.receivedAt) ||
      left.lead.id.localeCompare(right.lead.id),
    );
  const rejected = completed
    .filter((outcome): outcome is Extract<PerLeadResult, { kind: "rejected" }> => outcome.kind === "rejected")
    .map(({ lead, reasons }) => ({ lead, reasons }));
  const meta = completed
    .filter((outcome): outcome is Extract<PerLeadResult, { kind: "prioritized" }> => outcome.kind === "prioritized")
    .map((outcome) => outcome.meta);

  return PrioritizeResultSchema.parse({ ranked, rejected, meta });
}