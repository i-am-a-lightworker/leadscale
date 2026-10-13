import { z } from "zod";
import { createLeadAgent } from "../../../../lib/agent/agent";
import { mockModelRunner } from "../../../../lib/agent/mockRunner";
import { PRIORITIZE_CONFIG, PrioritizeResultSchema, prioritizeLeads } from "../../../../lib/agent/prioritize";
import { InMemoryLeadRepository } from "../../../../lib/data/leadRepository";

const PrioritizeRequestSchema = z.object({
  leadIds: z.array(z.string().trim().min(1)).optional(),
}).strict().superRefine((request, context) => {
  if (request.leadIds && new Set(request.leadIds).size !== request.leadIds.length) {
    context.addIssue({ code: "custom", message: "leadIds must not contain duplicates.", path: ["leadIds"] });
  }
});

const repository = new InMemoryLeadRepository();

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

    const result = await prioritizeLeads(selectedLeads, {
      modelRunner,
      timeoutMs: readPositiveInteger("AGENT_TIMEOUT_MS", PRIORITIZE_CONFIG.defaultTimeoutMs),
      concurrency: readPositiveInteger("AGENT_CONCURRENCY", PRIORITIZE_CONFIG.defaultConcurrency),
    });
    const validatedResult = PrioritizeResultSchema.parse(result);
    return Response.json(validatedResult);
  } catch {
    return errorResponse("PRIORITIZE_FAILED", "Lead prioritization could not be completed.", 500);
  }
}