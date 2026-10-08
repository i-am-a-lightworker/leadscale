import assert from "node:assert/strict";
import test from "node:test";
import { AgentOutputSchema, LeadSchema, PrioritizedLeadSchema } from "@/contracts/lead";
import { fakeScoreLeads } from "@/agent/mockScoring";
import { seedLeads } from "@/data/seedLeads";

test("all seed leads satisfy the shared contract", () => {
  assert.equal(LeadSchema.array().parse(seedLeads).length, 12);
});

test("seeded mock scores satisfy the agent output contract", () => {
  const scored = fakeScoreLeads(seedLeads);
  assert.equal(scored.length, seedLeads.length);
  for (const lead of scored) PrioritizedLeadSchema.parse(lead);
});

test("contact method is required", () => {
  const leadWithoutContact = { ...seedLeads[0], email: undefined, phone: undefined };
  assert.equal(LeadSchema.safeParse(leadWithoutContact).success, false);
});

test("score and priority ranges must agree", () => {
  assert.equal(
    AgentOutputSchema.safeParse({
      score: 85,
      priority: "High",
      reasons: ["Reason one", "Reason two"],
      nextAction: "Follow up.",
      missingInformation: [],
      confidence: 0.8,
    }).success,
    false,
  );
});