import { z } from "zod";
import {
  AssessmentSchema,
  LeadSchema,
  type Lead,
  type PrioritizedLead,
} from "../types/lead";

const PrioritizedEntrySchema = z
  .object({
    lead: LeadSchema,
    assessment: AssessmentSchema,
  })
  .strict();

const RejectedEntrySchema = z
  .object({
    lead: LeadSchema,
    reasons: z.array(z.string().min(1)),
  })
  .strict();

const PrioritizeMetaSchema = z
  .object({
    leadId: z.string(),
    source: z.enum(["agent", "fallback"]),
    retries: z.number().int().nonnegative(),
    adjustments: z.array(z.string()),
    flags: z.array(z.string()),
    durationMs: z.number().nonnegative(),
    promptVersion: z.string(),
  })
  .strict();

export const PrioritizeResultSchema = z
  .object({
    ranked: z.array(PrioritizedEntrySchema),
    rejected: z.array(RejectedEntrySchema),
    meta: z.array(PrioritizeMetaSchema),
  })
  .strict();

export type PrioritizeResult = z.infer<typeof PrioritizeResultSchema>;
export type RejectedLead = PrioritizeResult["rejected"][number];

const timestamp = (daysAgo: number): string =>
  new Date(
    Date.parse("2026-10-14T12:00:00.000Z") - daysAgo * 24 * 60 * 60 * 1000,
  ).toISOString();

type FixtureInput = {
  id: string;
  name: string;
  source: string;
  receivedDaysAgo: number;
  address: string;
  city: string;
  type: string;
  budgetMin: number;
  budgetMax: number;
  askingPrice?: number;
  score: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  reasons: [string, string] | [string, string, string];
  action: string;
  message: string;
  missingInformation?: string[];
  confidence?: "LOW" | "MEDIUM" | "HIGH";
  flags?: string[];
  modelSource?: "agent" | "fallback";
  contact?: { email?: string; phone?: string };
};

function makeLead(input: FixtureInput): Lead {
  return LeadSchema.parse({
    id: input.id,
    source: input.source,
    receivedAt: timestamp(input.receivedDaysAgo),
    name: input.name,
    email: input.contact?.email ?? `${input.id}@example.com`,
    ...(input.contact?.phone ? { phone: input.contact.phone } : {}),
    property: {
      address: input.address,
      city: input.city,
      propertyType: input.type,
      ...(input.askingPrice !== undefined
        ? { askingPrice: input.askingPrice }
        : {}),
    },
    budget: { min: input.budgetMin, max: input.budgetMax, currency: "USD" },
    timeline: { urgency: "WITHIN_30_DAYS" },
    message: input.message,
    engagement: {
      replyCount: input.score >= 80 ? 2 : 0,
      viewCount: input.score >= 60 ? 5 : 1,
      tourRequestCount: input.score >= 85 ? 1 : 0,
      lastActivityAt: timestamp(Math.max(0, input.receivedDaysAgo - 1)),
    },
    rawSourceData: { channel: input.source },
  });
}

function makePrioritized(input: FixtureInput): PrioritizedLead {
  return {
    lead: makeLead(input),
    assessment: AssessmentSchema.parse({
      score: input.score,
      priority: input.priority,
      reasons: input.reasons,
      recommendedAction: input.action,
      missingInformation: input.missingInformation ?? [],
      confidence: input.confidence ?? "HIGH",
    }),
  };
}

const entries: FixtureInput[] = [
  {
    id: "lead-001",
    name: "Maya Chen",
    source: "Website inquiry",
    receivedDaysAgo: 0,
    address: "418 Waverly Place, Unit 7B",
    city: "Brooklyn",
    type: "Condominium",
    budgetMin: 850000,
    budgetMax: 1050000,
    score: 96,
    priority: "URGENT",
    reasons: [
      "Requested a Saturday tour for this address.",
      "Confirmed financing and a move within 30 days.",
    ],
    action:
      "Call Maya now to confirm the Saturday tour window and access details.",
    message:
      "We are pre-approved and can view this weekend. Could we see the place Saturday afternoon?",
    missingInformation: ["Preferred Saturday time"],
    flags: ["REENGAGED: New activity followed a long inactivity gap."],
  },
  {
    id: "lead-002",
    name: "Jordan Ellis",
    source: "Referral",
    receivedDaysAgo: 0,
    address: "27 Orchard Street",
    city: "Jersey City",
    type: "Townhouse",
    budgetMin: 700000,
    budgetMax: 900000,
    score: 93,
    priority: "URGENT",
    reasons: [
      "A referred buyer asked for a call today.",
      "Their stated budget aligns with the requested neighborhood.",
    ],
    action: "Call Jordan today and offer two viewing times for this week.",
    message:
      "A colleague shared your details. We are hoping to move before the end of next month.",
  },
  {
    id: "lead-003",
    name: "Priya Raman",
    source: "Open house",
    receivedDaysAgo: 1,
    address: "95 Prospect Park West, Apartment 4",
    city: "Brooklyn",
    type: "Apartment",
    budgetMin: 1100000,
    budgetMax: 1350000,
    score: 88,
    priority: "URGENT",
    reasons: [
      "Asked for the disclosure packet after attending the open house.",
      "Returned to the listing several times this morning.",
    ],
    action:
      "Email the disclosure packet and ask whether Priya wants a second look.",
    message:
      "Thank you for showing us around. Please send the disclosures and any recent building notes.",
  },
  {
    id: "lead-004",
    name: "Elliot Brooks",
    source: "Property portal",
    receivedDaysAgo: 1,
    address: "160 Riverside Drive, Apt 12C",
    city: "New York",
    type: "Co-op",
    budgetMin: 1250000,
    budgetMax: 1450000,
    score: 83,
    priority: "HIGH",
    reasons: [
      "Requested a private showing for a specific unit.",
      "Has replied twice about the building's monthly costs.",
    ],
    action:
      "Text Elliot to confirm the showing and share the monthly carrying costs.",
    message:
      "Could you confirm the maintenance and available showing times? We can come Thursday.",
    flags: ["CONFLICT: Budget maximum is far below the property asking price."],
    modelSource: "fallback",
  },
  {
    id: "lead-005",
    name: "Taylor Brooks",
    source: "Property portal",
    receivedDaysAgo: 2,
    address: "11-42 44th Road, Long Island City, Queens, New York 11101",
    city: "Queens",
    type: "Condominium",
    budgetMin: 650000,
    budgetMax: 800000,
    askingPrice: 1300000,
    score: 76,
    priority: "HIGH",
    reasons: [
      "Asked whether the unit is available for a showing.",
      "Provided a reachable phone number and target budget.",
    ],
    action:
      "Text Taylor to confirm a preferred showing window for the unit.",
    message: "Is this still on the market? I can visit after work this week.",
    missingInformation: ["Preferred showing time"],
    confidence: "MEDIUM",
    flags: ["CONFLICT: Budget maximum is far below the property asking price."],
    contact: { phone: "+1 917 555 0192" },
  },
  {
    id: "lead-006",
    name: "Nadia Flores",
    source: "Website inquiry",
    receivedDaysAgo: 3,
    address: "6 Van Buren Street",
    city: "Brooklyn",
    type: "Brownstone",
    budgetMin: 900000,
    budgetMax: 1200000,
    score: 72,
    priority: "HIGH",
    reasons: [
      "Shared a three-month purchase horizon.",
      "Asked for information about nearby transit.",
    ],
    action:
      "Send Nadia the property's transit details and ask about her ideal viewing day.",
    message:
      "We are beginning our search and would love to understand the commute options.",
  },
  {
    id: "lead-007",
    name: "Samir Patel",
    source: "Agent referral",
    receivedDaysAgo: 4,
    address: "302 Dean Street",
    city: "Brooklyn",
    type: "Townhouse",
    budgetMin: 1050000,
    budgetMax: 1300000,
    score: 61,
    priority: "MEDIUM",
    reasons: [
      "The lead shared a defined budget range.",
      "No specific showing request or immediate timeline was included.",
    ],
    action:
      "Email Samir to ask which two neighborhoods should anchor the search.",
    message:
      "We are early in the process and comparing a few areas before booking appointments.",
    missingInformation: ["Preferred neighborhoods", "Purchase timeline"],
    confidence: "MEDIUM",
    flags: ["DUPLICATE: Possible duplicate of an existing lead."],
  },
  {
    id: "lead-008",
    name: "Clara Nguyen",
    source: "Open house",
    receivedDaysAgo: 5,
    address: "71 Underhill Avenue",
    city: "Brooklyn",
    type: "Condominium",
    budgetMin: 550000,
    budgetMax: 700000,
    score: 55,
    priority: "MEDIUM",
    reasons: [
      "Visited an open house and left a valid contact number.",
      "Budget is plausible, but no follow-up preference was stated.",
    ],
    action:
      "Call Clara during business hours to ask what she thought of the layout.",
    message:
      "Thanks for hosting. The second bedroom might work for us, but we need to think it over.",
    confidence: "LOW",
    missingInformation: ["Target move date"],
  },
  {
    id: "lead-009",
    name: "Theo Martin",
    source: "Property portal",
    receivedDaysAgo: 6,
    address: "9 Jay Street, Floor 3",
    city: "Brooklyn",
    type: "Loft",
    budgetMin: 750000,
    budgetMax: 950000,
    score: 48,
    priority: "MEDIUM",
    reasons: [
      "Saved a property and asked for current availability.",
      "Did not provide a purchase timeframe.",
    ],
    action: "Reply with current availability and ask when Theo hopes to move.",
    message:
      "I saved this listing. Please let me know if it is still available.",
    missingInformation: ["Purchase timeline", "Financing status"],
    confidence: "MEDIUM",
  },
  {
    id: "lead-010",
    name: "Avery Williams",
    source: "Email inquiry",
    receivedDaysAgo: 8,
    address: "44-18 23rd Street",
    city: "Queens",
    type: "Condominium",
    budgetMin: 400000,
    budgetMax: 560000,
    score: 34,
    priority: "LOW",
    reasons: [
      "Asked for general information with no viewing request.",
      "No timing or financing details were included.",
    ],
    action:
      "Send Avery the listing sheet and ask whether a purchase this year is realistic.",
    message:
      "Could you send the floor plan and any details about the building?",
    missingInformation: ["Purchase timeline", "Financing status"],
    confidence: "LOW",
  },
  {
    id: "lead-011",
    name: "Morgan Reed",
    source: "Website inquiry",
    receivedDaysAgo: 10,
    address: "88 Willow Street, Apt 2A",
    city: "Brooklyn",
    type: "Apartment",
    budgetMin: 350000,
    budgetMax: 475000,
    score: 23,
    priority: "LOW",
    reasons: [
      "The inquiry is exploratory and has no next-step request.",
      "Contact details are present, but the budget needs clarification.",
    ],
    action: "Email Morgan to confirm the comfortable monthly payment range.",
    message:
      "Just starting to look around and trying to understand what is possible.",
    missingInformation: ["Monthly payment range", "Target move date"],
    confidence: "LOW",
  },
  {
    id: "lead-012",
    name: "Riley Thompson",
    source: "Property portal",
    receivedDaysAgo: 16,
    address: "124 Pacific Street",
    city: "Brooklyn",
    type: "Townhouse",
    budgetMin: 800000,
    budgetMax: 1000000,
    score: 12,
    priority: "LOW",
    reasons: [
      "The inquiry is more than two weeks old.",
      "No reply or viewing activity has been recorded.",
    ],
    action:
      "Send one brief check-in asking whether Riley is still looking in the area.",
    message: "Please share more information when you have a chance.",
    missingInformation: ["Purchase timeline", "Preferred property type"],
    confidence: "LOW",
    flags: ["STALE: Lead was received beyond the stale threshold."],
  },
];

const prioritized = entries.map(makePrioritized);
const rejected = [
  {
    lead: makeLead({
      id: "lead-013",
      name: "Casey Morgan",
      source: "Website inquiry",
      receivedDaysAgo: 1,
      address: "18 Wyckoff Street",
      city: "Brooklyn",
      type: "Apartment",
      budgetMin: 500000,
      budgetMax: 650000,
      score: 0,
      priority: "LOW",
      reasons: ["Not prioritized.", "Rejected during intake."],
      action: "No action",
      message: "test message",
      contact: { email: "casey.morgan@example.com" },
    }),
    reasons: ["Lead appears to be a spam or test record."],
  },
  {
    lead: makeLead({
      id: "lead-014",
      name: "Taylor Rivera",
      source: "Referral",
      receivedDaysAgo: 2,
      address: "210 Clinton Avenue",
      city: "Brooklyn",
      type: "Condominium",
      budgetMin: 700000,
      budgetMax: 850000,
      score: 0,
      priority: "LOW",
      reasons: ["Not prioritized.", "Rejected during intake."],
      action: "No action",
      message: "Please contact me about the listing.",
    }),
    reasons: ["Duplicate of the newer lead record."],
  },
];

export const fixturePrioritizeResult = PrioritizeResultSchema.parse({
  ranked: prioritized,
  rejected,
  meta: entries.map((entry, index) => ({
    leadId: entry.id,
    source: entry.modelSource ?? "agent",
    retries: entry.modelSource === "fallback" ? 1 : 0,
    adjustments: [],
    flags: entry.flags ?? [],
    durationMs: index * 7 + 18,
    promptVersion: "1.0.0",
  })),
});

export const fixturePrioritizedLeads = fixturePrioritizeResult.ranked;
export const fixtureRejectedLeads = fixturePrioritizeResult.rejected;
export const fixtureLeads = [
  ...fixturePrioritizeResult.ranked.map((entry) => entry.lead),
  ...fixturePrioritizeResult.rejected.map((entry) => entry.lead),
];
