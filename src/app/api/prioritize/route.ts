import { z } from "zod";
import { createLeadAgent } from "../../../../lib/agent/agent";
import { mockModelRunner } from "../../../../lib/agent/mockRunner";
import { AGENT_PROMPT_VERSION, PRIORITIZE_CONFIG, PrioritizeResultSchema, prioritizeLeads } from "../../../../lib/agent/prioritize";
import { getLeadRepository } from "../../../../lib/data";
import { leadAssessmentInputHash } from "../../../../lib/data/leadHash";
import { hasFreshAssessment } from "../../../../lib/data/assessmentCache";
import { randomUUID } from "node:crypto";
import { getMockSimulation, waitForDemoSimulation } from "../../../../lib/demo/simulations";
import { guardProtectedRoute } from "../../../../lib/security/routeGuard";
import { ROUTE_SECURITY_CONFIG } from "../../../../lib/security/config";
import { decodeRequestText, readBoundedBytes } from "../../../../lib/intake/http";
import { validateAndConstrain } from "../../../../lib/agent/validateAssessment";

// The current Vercel docs cap Hobby functions at 300 seconds; this bounded run fits comfortably below that limit.
export const maxDuration = 120;

const PrioritizeRequestSchema = z.object({
  leadIds: z.array(z.string().trim().min(1)).optional(),
}).strict().superRefine((request, context) => {
  if (request.leadIds && new Set(request.leadIds).size !== request.leadIds.length) {
    context.addIssue({ code: "custom", message: "leadIds must not contain duplicates.", path: ["leadIds"] });
  }
});

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function readPositiveInteger(name: string, defaultValue: number, maximum: number): number {
  const configured = process.env[name];
  if (configured === undefined || configured.trim() === "") return defaultValue;
  const value = Number(configured);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  return value;
}

export async function POST(request: Request): Promise<Response> {
  const requestStartedAt = Date.now();
  const accessError = guardProtectedRoute(request, "prioritize");
  if (accessError) return accessError;
  const simulation = getMockSimulation(request);
  if (simulation === "error") return errorResponse("SIMULATED_ERROR", "Prioritization could not be completed.", 503);
  await waitForDemoSimulation(simulation);

  let bytes: Uint8Array | null;
  try {
    bytes = await readBoundedBytes(request, ROUTE_SECURITY_CONFIG.maxPrioritizeRequestBytes);
  } catch {
    return errorResponse("INVALID_REQUEST", "Prioritization request could not be read.", 400);
  }
  if (!bytes) return errorResponse("PAYLOAD_TOO_LARGE", "Prioritization request exceeds the size limit.", 413);
  const requestText = decodeRequestText(bytes);
  let rawBody: unknown;
  try {
    rawBody = bytes.length === 0 ? {} : requestText === null ? null : JSON.parse(requestText) as unknown;
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }
  const parsed = PrioritizeRequestSchema.safeParse(rawBody);
  if (!parsed.success) return errorResponse("INVALID_REQUEST", "Request body must contain optional unique leadIds.", 400);

  try {
    const repository = getLeadRepository();
    const leads = await repository.list();
    const selectedLeads = parsed.data.leadIds
      ? leads.filter((lead) => parsed.data.leadIds?.includes(lead.id))
      : leads;
    if (parsed.data.leadIds && selectedLeads.length !== parsed.data.leadIds.length) {
      return errorResponse("LEAD_NOT_FOUND", "One or more requested leads were not found.", 404);
    }
    if (selectedLeads.length > ROUTE_SECURITY_CONFIG.maxPrioritizeLeads) {
      return errorResponse("LEAD_LIMIT_EXCEEDED", `At most ${ROUTE_SECURITY_CONFIG.maxPrioritizeLeads} leads may be prioritized per request.`, 413);
    }

    const mode = process.env.AGENT_MODE ?? "mock";
    if (mode !== "mock" && mode !== "live") {
      return errorResponse("INVALID_CONFIGURATION", "AGENT_MODE must be mock or live.", 500);
    }
    let modelRunner = mockModelRunner;
    if (simulation === "fallback" && mode === "mock") {
      modelRunner = async () => { throw new Error("Requested mock fallback simulation."); };
    }
    if (mode === "live") {
      if (!process.env.OPENAI_API_KEY || !process.env.AGENT_MODEL) {
        return errorResponse("AGENT_CONFIGURATION_REQUIRED", "Live mode requires OPENAI_API_KEY and AGENT_MODEL.", 503);
      }
      const configuredMessageLimit = readPositiveInteger(
        "LEAD_MESSAGE_MAX_CHARS",
        ROUTE_SECURITY_CONFIG.maxLeadMessageChars,
        ROUTE_SECURITY_CONFIG.maxLeadMessageChars,
      );
      modelRunner = await createLeadAgent({
        repository,
        modelName: process.env.AGENT_MODEL,
        maxMessageChars: configuredMessageLimit,
      });
    }

    const stored = await repository.getLatestAssessments(selectedLeads.map((lead) => lead.id));
    const cacheHits = (simulation === "fallback" ? [] : selectedLeads).flatMap((lead) => {
      const cached = stored[lead.id];
      if (!hasFreshAssessment(lead, cached, AGENT_PROMPT_VERSION) || !cached) return [];
      return [{
        lead,
        assessment: cached.assessment,
        meta: {
          leadId: lead.id,
          source: cached.source,
          retries: 0,
          adjustments: cached.adjustments,
          flags: cached.flags,
          durationMs: 0,
          promptVersion: cached.promptVersion,
        },
      }];
    });
    const cacheIds = new Set(cacheHits.map(({ lead }) => lead.id));
    const leadsToPrioritize = selectedLeads.filter((lead) => !cacheIds.has(lead.id));
    const selectedById = new Map(selectedLeads.map((lead) => [lead.id, lead]));
    let validationFailureCount = 0;
    let modelCallCount = 0;
    const monitoredRunner = async (input: Parameters<typeof modelRunner>[0]): Promise<unknown> => {
      modelCallCount += 1;
      const output = await modelRunner(input);
      const lead = selectedById.get(input.leadId);
      if (lead) {
        try {
          validateAndConstrain(output, input.preScore, lead, input.flags, input.breakdown);
        } catch {
          validationFailureCount += 1;
        }
      }
      return output;
    };
    const fresh = await prioritizeLeads(leadsToPrioritize, {
      modelRunner: monitoredRunner,
      filterBatch: leads,
      timeoutMs: readPositiveInteger("AGENT_TIMEOUT_MS", PRIORITIZE_CONFIG.defaultTimeoutMs, ROUTE_SECURITY_CONFIG.maxAgentTimeoutMs),
      concurrency: readPositiveInteger("AGENT_CONCURRENCY", PRIORITIZE_CONFIG.defaultConcurrency, ROUTE_SECURITY_CONFIG.maxAgentConcurrency),
    });
    await repository.saveAssessments(fresh.meta.map((meta) => {
      const prioritized = fresh.ranked.find((item) => item.lead.id === meta.leadId);
      if (!prioritized) throw new Error("Assessment result is missing its lead.");
      return {
        leadId: meta.leadId,
        assessment: prioritized.assessment,
        source: meta.source,
        promptVersion: meta.promptVersion,
        adjustments: meta.adjustments,
        flags: meta.flags,
        inputHash: leadAssessmentInputHash(selectedById.get(meta.leadId) ?? prioritized.lead, meta.promptVersion),
      };
    }));
    await repository.saveRejected(fresh.rejected.map(({ lead, reasons }) => ({
      leadId: lead.id,
      raw: lead.rawSourceData,
      reasons,
    })));

    const runId = randomUUID();
    const allMeta = [...fresh.meta, ...cacheHits.map(({ meta }) => meta)];
    const latencies = allMeta.map(({ durationMs }) => durationMs).sort((left, right) => left - right);
    const percentile = (fraction: number): number => latencies.length === 0
      ? 0
      : latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * fraction) - 1)] ?? 0;
    const runSummary = {
      runId,
      mode,
      promptVersion: AGENT_PROMPT_VERSION,
      leadCount: selectedLeads.length,
      scoredCount: fresh.ranked.length + cacheHits.length,
      rejectedCount: fresh.rejected.length,
      fallbackCount: allMeta.filter(({ source }) => source === "fallback").length,
      validationFailureCount,
      totalDurationMs: Date.now() - requestStartedAt,
      p50LatencyMs: percentile(0.5),
      p95LatencyMs: percentile(0.95),
    } as const;
    await repository.savePrioritizeRun(runSummary);
    console.info(JSON.stringify({
      event: "prioritize_run",
      ...runSummary,
      modelCallCount,
    }));

    const ranked = [...fresh.ranked, ...cacheHits.map(({ lead, assessment }) => ({ lead, assessment }))]
      .sort((left, right) => right.assessment.score - left.assessment.score ||
        Date.parse(right.lead.receivedAt) - Date.parse(left.lead.receivedAt) || left.lead.id.localeCompare(right.lead.id));
    const validatedResult = PrioritizeResultSchema.parse({
      ranked,
      rejected: fresh.rejected,
      meta: [...fresh.meta, ...cacheHits.map(({ meta }) => meta)],
    });
    return Response.json(validatedResult);
  } catch {
    return errorResponse("PRIORITIZE_FAILED", "Lead prioritization could not be completed.", 500);
  }
}