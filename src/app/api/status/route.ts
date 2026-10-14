import { getLeadRepository } from "../../../../lib/data";
import { AGENT_PROMPT_VERSION } from "../../../../lib/agent/prioritize";
import { StatusApiResponseSchema } from "../../../../lib/types/api";

export async function GET(): Promise<Response> {
  try {
    const counts = await getLeadRepository().getOperationalCounts();
    const backend = process.env.DATA_BACKEND === "supabase" ? "supabase" : "memory";
    const mode = process.env.AGENT_MODE === "live" ? "live" : "mock";
    return Response.json(StatusApiResponseSchema.parse({
      status: "ok",
      mode,
      backend,
      promptVersion: AGENT_PROMPT_VERSION,
      counts: {
        ...counts,
        fallbackRate: counts.scored === 0 ? 0 : counts.fallback / counts.scored,
      },
    }));
  } catch {
    return Response.json({ error: { code: "STATUS_UNAVAILABLE", message: "System status could not be retrieved." } }, { status: 500 });
  }
}