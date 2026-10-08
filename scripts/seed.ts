import { createClient } from "@supabase/supabase-js";
import { fakeScoreLeads } from "@/agent/mockScoring";
import { seedLeads } from "@/data/seedLeads";
import type { Database, Json } from "@/data/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const leadRows = seedLeads.map((lead) => ({
  id: lead.id,
  source: lead.source,
  received_at: lead.receivedAt,
  name: lead.name,
  email: lead.email ?? null,
  phone: lead.phone ?? null,
  property: lead.property as Json,
  budget: lead.budget as Json,
  timeline: lead.timeline,
  message: lead.message,
  engagement: lead.engagement as Json,
  raw_source_data: lead.rawSourceData as Json,
}));

const { error: leadError } = await supabase.from("leads").upsert(leadRows);
if (leadError) throw leadError;

const scoreRows = fakeScoreLeads(seedLeads).map((lead) => ({
  lead_id: lead.id,
  score: lead.score,
  priority: lead.priority,
  reasons: lead.reasons as Json,
  next_action: lead.nextAction,
  missing_information: lead.missingInformation as Json,
  confidence: lead.confidence,
}));

const { error: scoreError } = await supabase
  .from("lead_scores")
  .upsert(scoreRows, { onConflict: "lead_id" });
if (scoreError) throw scoreError;

console.info(`Seeded ${leadRows.length} leads and ${scoreRows.length} mock scores.`);