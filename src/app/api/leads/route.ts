import { LeadsSchema } from "@/contracts/lead";
import { seedLeads } from "@/data/seedLeads";
import { validatedJson } from "@/lib/validatedJson";

export function GET() {
  return validatedJson(LeadsSchema, seedLeads);
}