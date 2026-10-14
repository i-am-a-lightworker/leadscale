import { z } from "zod";
import { createLeadAgent } from "../../../../lib/agent/agent";
import { mockModelRunner } from "../../../../lib/agent/mockRunner";
import { AGENT_PROMPT_VERSION, PRIORITIZE_CONFIG, PrioritizeResultSchema, prioritizeLeads } from "../../../../lib/agent/prioritize";
import { getLeadRepository } from "../../../../lib/data";
import { leadAssessmentInputHash } from "../../../../lib/data/leadHash";
import { hasFreshAssessment } from "../../../../lib/data/assessmentCache";

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

function readPositiveInteger(name: string, defaultValue: number): number {
  const configured = process.env[name];
  if (configured === undefined || configured.trim() === "") return defaultValue;
  const value = Number(configured);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

export async function POST(request: Request): Promise<Response> {
  const rawBody: unknown = request.body === null ? {} : await request.json().catch(() => null);
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

    const mode = process.env.AGENT_MODE ?? "mock";
    if (mode !== "mock" && mode !== "live") {
      return errorResponse("INVALID_CONFIGURATION", "AGENT_MODE must be mock or live.", 500);
    }
    let modelRunner = mockModelRunner;
    if (mode === "live") {
      if (!process.env.OPENAI_API_KEY || !process.env.AGENT_MODEL) {
        return errorResponse("AGENT_CONFIGURATION_REQUIRED", "Live mode requires OPENAI_API_KEY and AGENT_MODEL.", 503);
      }
      const configuredMessageLimit = readPositiveInteger("LEAD_MESSAGE_MAX_CHARS", 4000);
      modelRunner = await createLeadAgent({
        repository,
        modelName: process.env.AGENT_MODEL,
        maxMessageChars: configuredMessageLimit,
      });
    }

    const stored = await repository.getLatestAssessments(selectedLeads.map((lead) => lead.id));
    const cacheHits = selectedLeads.flatMap((lead) => {
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
    const fresh = await prioritizeLeads(leadsToPrioritize, {
      modelRunner,
      filterBatch: leads,
      timeoutMs: readPositiveInteger("AGENT_TIMEOUT_MS", PRIORITIZE_CONFIG.defaultTimeoutMs),
      concurrency: readPositiveInteger("AGENT_CONCURRENCY", PRIORITIZE_CONFIG.defaultConcurrency),
    });
    const selectedById = new Map(selectedLeads.map((lead) => [lead.id, lead]));
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