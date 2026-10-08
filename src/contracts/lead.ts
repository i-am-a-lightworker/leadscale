import { z } from "zod";

export const LeadSourceSchema = z.enum(["csv", "email-forward", "manual"]);
export type LeadSource = z.infer<typeof LeadSourceSchema>;

export const PropertySchema = z
  .object({
    address: z.string().optional(),
    city: z.string().optional(),
    type: z.string().optional(),
    askingPrice: z.number().nonnegative().optional(),
  })
  .strict();

export const BudgetSchema = z
  .object({
    minimum: z.number().nonnegative().optional(),
    maximum: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
  })
  .strict();

export const EngagementSchema = z
  .object({
    touchCount: z.number().int().nonnegative(),
    lastActivityAt: z.string().datetime({ offset: true }).optional(),
    recentReengagement: z.boolean(),
  })
  .strict();

const LeadObjectSchema = z
  .object({
    id: z.string().uuid(),
    source: LeadSourceSchema,
    receivedAt: z.string().datetime({ offset: true }),
    name: z.string().trim().min(1),
    email: z.string().email().optional(),
    phone: z.string().trim().min(1).optional(),
    property: PropertySchema,
    budget: BudgetSchema,
    timeline: z.string().trim().min(1),
    message: z.string(),
    engagement: EngagementSchema,
    rawSourceData: z.record(z.string(), z.unknown()),
  })
  .strict();

export const LeadSchema = LeadObjectSchema.refine(
  (lead) => Boolean(lead.email || lead.phone),
  { message: "A lead must include an email address or phone number.", path: ["email"] },
);
export type Lead = z.infer<typeof LeadSchema>;

export const PRIORITY_SCORE_RANGES = {
  Low: { min: 0, max: 39 },
  Medium: { min: 40, max: 64 },
  High: { min: 65, max: 84 },
  Urgent: { min: 85, max: 100 },
} as const;

export const PrioritySchema = z.enum(["Low", "Medium", "High", "Urgent"]);
export type Priority = z.infer<typeof PrioritySchema>;

const AgentOutputObjectSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    priority: PrioritySchema,
    reasons: z.array(z.string().trim().min(1)).min(2).max(3),
    nextAction: z.string().trim().min(1),
    missingInformation: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const AgentOutputSchema = AgentOutputObjectSchema.superRefine((output, context) => {
  const range = PRIORITY_SCORE_RANGES[output.priority];
  if (output.score < range.min || output.score > range.max) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Score ${output.score} is outside the ${output.priority} range (${range.min}-${range.max}).`,
      path: ["score"],
    });
  }
});
export type AgentOutput = z.infer<typeof AgentOutputSchema>;

export const PrioritizedLeadSchema = z.intersection(LeadSchema, AgentOutputSchema);
export type PrioritizedLead = z.infer<typeof PrioritizedLeadSchema>;

export const LeadsSchema = z.array(LeadSchema);
export const PrioritizedLeadsSchema = z.array(PrioritizedLeadSchema);

export interface LeadAdapter {
  parse(input: unknown): Lead[];
}

export const PrioritizeRequestSchema = z
  .object({ leads: LeadsSchema.optional() })
  .strict();
export type PrioritizeRequest = z.infer<typeof PrioritizeRequestSchema>;

export const EmailIntakeRequestSchema = z
  .object({
    from: z.string().min(1),
    subject: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
  })
  .passthrough();

export const ErrorResponseSchema = z.object({ error: z.string().min(1) }).strict();
export const HealthResponseSchema = z.object({ status: z.literal("ok") }).strict();

export const LeadRetrievalInputSchema = z.object({ leadId: z.string().uuid() }).strict();