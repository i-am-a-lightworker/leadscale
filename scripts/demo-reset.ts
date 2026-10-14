import { loadEnvConfig } from "@next/env";
import { seedLeads } from "../lib/data/seedLeads";
import { getLeadRepository } from "../lib/data";

loadEnvConfig(process.cwd());
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("demo:reset requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const repository = getLeadRepository("supabase");
for (const lead of seedLeads) await repository.deleteLead(lead.id);
await repository.saveLeads(seedLeads);
const counts = await repository.getOperationalCounts();
console.info(JSON.stringify({ event: "demo_reset_complete", seededLeadCount: seedLeads.length, totalLeadCount: counts.leads }));