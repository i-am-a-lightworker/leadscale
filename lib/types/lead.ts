import { z } from "zod";

export const LeadSourceSchema = z.string().trim().min(1);

export const PropertySchema = z
  .object({
    address: z.string().trim().min(1).optional(), // Street address or listing identifier.
    city: z.string().trim().min(1).optional(), // City where the property is located.
    propertyType: z.string().trim().min(1).optional(), // Home, condo, land, or another property type.
    askingPrice: z.number().nonnegative().optional(), // Listed asking price in the lead's budget currency.
  })
  .strict();

export const BudgetSchema = z
  .object({
    min: z.number().nonnegative().optional(), // Lowest budget the lead is considering.
    max: z.number().nonnegative().optional(), // Highest budget the lead is considering.
    currency: z.string().regex(/^[A-Z]{3}$/), // ISO 4217 currency code, such as USD.
  })
  .strict()
  .refine((budget) => budget.min === undefined || budget.max === undefined || budget.min <= budget.max, {
    message: "Budget minimum cannot exceed budget maximum.",
    path: ["min"],
  });

export const TimelineSchema = z
  .object({
    urgency: z.enum(["IMMEDIATE", "WITHIN_30_DAYS", "WITHIN_3_MONTHS", "FLEXIBLE"]).optional(), // Lead-stated buying timeframe.
    targetMoveDate: z.string().datetime({ offset: true }).optional(), // Lead-stated desired move-in date.
  })
  .strict();

export const EngagementSchema = z
  .object({
    replyCount: z.number().int().nonnegative(), // Number of replies from the lead.
    viewCount: z.number().int().nonnegative(), // Number of listing or property views.
    tourRequestCount: z.number().int().nonnegative(), // Number of tour requests.
    lastActivityAt: z.string().datetime({ offset: true }).optional(), // Timestamp of the latest observed activity.
    previousActivityAt: z.string().datetime({ offset: true }).optional(), // Activity before the latest one, if known.
  })
  .strict();

const LeadObjectSchema = z
  .object({
    id: z.string().trim().min(1),
    source: LeadSourceSchema,
    receivedAt: z.string().datetime({ offset: true }),
    name: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(1).optional(),
    property: PropertySchema,
    budget: BudgetSchema,
    timeline: TimelineSchema,
    message: z.string(),
    engagement: EngagementSchema,
    rawSourceData: z.record(z.string(), z.unknown()),
  })
  .strict();

export const LeadSchema = LeadObjectSchema.refine((lead) => Boolean(lead.email || lead.phone), {
  message: "A lead must include an email address or phone number.",
  path: ["email"],
});

export type Lead = z.infer<typeof LeadSchema>;

export const AssessmentSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    reasons: z.array(z.string().trim().min(1)).min(2).max(3),
    recommendedAction: z.string().trim().min(1),
    missingInformation: z.array(z.string()),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  })
  .strict();

export type Assessment = z.infer<typeof AssessmentSchema>;

export type PrioritizedLead = {
  lead: Lead;
  assessment: Assessment;
};

export type FilterResult =
  | { status: "eligible"; lead: Lead }
  | { status: "rejected"; lead: unknown; reasons: string[] }
  | { status: "flagged"; lead: Lead; flags: string[] };

export const PRIORITY_BANDS = {
  LOW: { min: 0, max: 39 },
  MEDIUM: { min: 40, max: 64 },
  HIGH: { min: 65, max: 84 },
  URGENT: { min: 85, max: 100 },
} as const;

export type Priority = keyof typeof PRIORITY_BANDS;

export function priorityFromScore(score: number): Priority {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new RangeError("Score must be an integer from 0 through 100.");
  }

  for (const [priority, range] of Object.entries(PRIORITY_BANDS) as [
    Priority,
    (typeof PRIORITY_BANDS)[Priority],
  ][]) {
    if (score >= range.min && score <= range.max) return priority;
  }

  throw new Error(`No priority band is configured for score ${score}.`);
}
