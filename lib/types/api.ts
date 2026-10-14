import { z } from "zod";
import { AGENT_PROMPT_VERSION, PrioritizeResultSchema } from "../agent/prioritize";
import { AssessmentSchema, LeadSchema } from "./lead";

export const ApiErrorResponseSchema = z.object({
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }).strict(),
}).strict();
export const LegacyMessageErrorResponseSchema = z.object({ error: z.string().min(1) }).strict();

export const LegacyLeadDetailResponseSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(["csv", "email-forward", "manual"]),
  receivedAt: z.string().datetime({ offset: true }),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  property: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    type: z.string().optional(),
    askingPrice: z.number().nonnegative().optional(),
  }).strict(),
  budget: z.object({
    minimum: z.number().nonnegative().optional(),
    maximum: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
  }).strict(),
  timeline: z.string().min(1),
  message: z.string(),
  engagement: z.object({
    touchCount: z.number().int().nonnegative(),
    lastActivityAt: z.string().datetime({ offset: true }).optional(),
    recentReengagement: z.boolean(),
  }).strict(),
  rawSourceData: z.record(z.string(), z.unknown()),
  score: z.number().int().min(0).max(100),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  reasons: z.array(z.string().min(1)).min(2).max(3),
  nextAction: z.string().min(1),
  missingInformation: z.array(z.string()),
  confidence: z.number().min(0).max(1),
}).strict();

export const LeadListResponseSchema = LeadSchema.array();
export const PrioritizeApiResponseSchema = PrioritizeResultSchema;
export const HealthApiResponseSchema = z.object({ status: z.literal("ok") }).strict();
export const IntakeApiResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.array(z.object({ row: z.number().int().positive().optional(), message: z.string().min(1) }).strict()),
}).strict();

export const StatusApiResponseSchema = z.object({
  status: z.literal("ok"),
  mode: z.enum(["mock", "live"]),
  backend: z.enum(["memory", "supabase"]),
  promptVersion: z.literal(AGENT_PROMPT_VERSION),
  counts: z.object({
    leads: z.number().int().nonnegative(),
    scored: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    fallback: z.number().int().nonnegative(),
    fallbackRate: z.number().min(0).max(1),
    runs: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export const AssessmentApiSchema = AssessmentSchema;