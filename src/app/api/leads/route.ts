import { LeadSchema } from "../../../../lib/types/lead";
import { getLeadRepository } from "../../../../lib/data";

export async function GET(): Promise<Response> {
  try {
    const leads = await getLeadRepository().list();
    return Response.json(LeadSchema.array().parse(leads));
  } catch {
    return Response.json(
      { error: { code: "LEADS_UNAVAILABLE", message: "Leads could not be retrieved." } },
      { status: 500 },
    );
  }
}