import {
  PRIORITY_SCORE_RANGES,
  type AgentOutput,
  type Lead,
  type PrioritizedLead,
  type Priority,
  PrioritizedLeadSchema,
} from "@/contracts/lead";

const mockOutputs: readonly AgentOutput[] = [
  { score: 92, priority: "Urgent", reasons: ["Pre-approved and ready to tour", "Move is planned within 30 days"], nextAction: "Call today and book a showing this week.", missingInformation: [], confidence: 0.94 },
  { score: 24, priority: "Low", reasons: ["No purchase timeline provided", "Message indicates early browsing"], nextAction: "Send a low-pressure note asking about timing.", missingInformation: ["Budget", "Timeline", "Financing status"], confidence: 0.76 },
  { score: 48, priority: "Medium", reasons: ["Has a clear home feature in mind", "Budget and timeline are missing"], nextAction: "Ask for a comfortable price range and target move date.", missingInformation: ["Budget", "Timeline", "Financing status"], confidence: 0.66 },
  { score: 32, priority: "Low", reasons: ["Budget is well below the listing price", "Purchase timing is still broad"], nextAction: "Confirm whether the budget or target property is flexible.", missingInformation: ["Budget flexibility"], confidence: 0.91 },
  { score: 41, priority: "Medium", reasons: ["Search needs and budget are usable", "A likely duplicate record exists"], nextAction: "Merge the contact history before outreach.", missingInformation: [], confidence: 0.73 },
  { score: 72, priority: "High", reasons: ["Recent reply signals renewed intent", "Weekend tour availability is specific"], nextAction: "Confirm a weekend tour and merge the duplicate record.", missingInformation: ["Financing status"], confidence: 0.86 },
  { score: 87, priority: "Urgent", reasons: ["Previously inactive lead has re-engaged", "Requested a tour this Saturday"], nextAction: "Reply today with Saturday tour options.", missingInformation: ["Financing status"], confidence: 0.9 },
  { score: 79, priority: "High", reasons: ["Financing is arranged", "Neighborhood and move deadline are clear"], nextAction: "Send matching homes and schedule a buyer consultation.", missingInformation: [], confidence: 0.89 },
  { score: 18, priority: "Low", reasons: ["Property needs are not yet specific", "Budget and timeline are missing"], nextAction: "Ask for preferred areas and an approximate budget.", missingInformation: ["Property needs", "Budget", "Timeline", "Email address"], confidence: 0.81 },
  { score: 37, priority: "Low", reasons: ["A purchase range is available", "Contact preference needs a portal workflow"], nextAction: "Check the portal for a permitted reply path.", missingInformation: ["Preferred contact route"], confidence: 0.71 },
  { score: 90, priority: "Urgent", reasons: ["Lead has re-engaged with a clear selling intent", "Requested an in-person valuation this week"], nextAction: "Call today to schedule the valuation visit.", missingInformation: ["Property address"], confidence: 0.9 },
  { score: 52, priority: "Medium", reasons: ["Requested an immediate viewing", "Move date is a year away"], nextAction: "Clarify whether the requested tour is exploratory or time-sensitive.", missingInformation: ["Purchase trigger"], confidence: 0.85 },
];

function assertPriorityScore(score: number, priority: Priority): void {
  const range = PRIORITY_SCORE_RANGES[priority];
  if (score < range.min || score > range.max) {
    throw new Error(`Mock score ${score} does not match ${priority}.`);
  }
}

export function fakeScoreLeads(leads: Lead[]): PrioritizedLead[] {
  return leads.map((lead, index) => {
    const output = mockOutputs[index % mockOutputs.length];
    assertPriorityScore(output.score, output.priority);
    return PrioritizedLeadSchema.parse({ ...lead, ...output });
  });
}