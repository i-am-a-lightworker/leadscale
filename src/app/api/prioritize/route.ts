import {
  PrioritizeRequestSchema,
  PrioritizedLeadsSchema,
} from "@/contracts/lead";
import { seedLeads } from "@/data/seedLeads";
import { fakeScoreLeads } from "@/agent/mockScoring";
import { errorResponse, validatedJson } from "@/lib/validatedJson";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = PrioritizeRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid prioritize request.", 400);

  const leads = parsed.data.leads ?? seedLeads;
  return validatedJson(PrioritizedLeadsSchema, fakeScoreLeads(leads));
}