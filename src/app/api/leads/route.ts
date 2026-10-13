import { LeadSchema } from "../../../../lib/types/lead";
import { InMemoryLeadRepository } from "../../../../lib/data/leadRepository";

const repository = new InMemoryLeadRepository();

export async function GET(): Promise<Response> {
  try {
    const leads = await repository.list();
    return Response.json(LeadSchema.array().parse(leads));
  } catch {
    return Response.json(
      { error: { code: "LEADS_UNAVAILABLE", message: "Leads could not be retrieved." } },
      { status: 500 },
    );
  }
}