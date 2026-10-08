import { LeadRetrievalInputSchema, PrioritizedLeadSchema } from "@/contracts/lead";
import { seedLeads } from "@/data/seedLeads";
import { fakeScoreLeads } from "@/agent/mockScoring";
import { errorResponse, validatedJson } from "@/lib/validatedJson";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsedId = LeadRetrievalInputSchema.safeParse({ leadId: id });
  if (!parsedId.success) return errorResponse("Invalid lead id.", 400);

  const lead = seedLeads.find((item) => item.id === parsedId.data.leadId);
  if (!lead) return errorResponse("Lead not found.", 404);

  const scored = fakeScoreLeads(seedLeads).find((item) => item.id === lead.id);
  return validatedJson(PrioritizedLeadSchema, scored);
}