import { loadEnvConfig } from "@next/env";
import { getLeadRepository } from "../lib/data";
import { seedLeads } from "../lib/data/seedLeads";

loadEnvConfig(process.cwd());
const repository = getLeadRepository("supabase");
await repository.saveLeads(seedLeads);
console.info(`Processed ${seedLeads.length} seed leads.`);