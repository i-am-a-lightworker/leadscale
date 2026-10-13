import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { scoreLead } from "../../agent/scoring";
import { filterLead } from "../../filtering/leadFilter";
import {
  BudgetSchema,
  EngagementSchema,
  LeadSourceSchema,
  PropertySchema,
  TimelineSchema,
} from "../../types/lead";
import type { LeadRepository } from "../../data/leadRepository";

export const GetLeadInputSchema = z.object({ leadId: z.string().trim().min(1) }).strict();

const SanitizedLeadSchema = z.object({
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
}).strict().refine((lead) => Boolean(lead.email || lead.phone), {
  message: "A lead must include an email address or phone number.",
  path: ["email"],
});
const ScoreFactorSchema = z.object({ factor: z.string(), points: z.number(), note: z.string() }).strict();

export const GetLeadOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_found"), leadId: z.string() }).strict(),
  z.object({
    status: z.literal("found"),
    lead: SanitizedLeadSchema,
    flags: z.array(z.string()),
    preScore: z.number().int().min(0).max(100),
    breakdown: z.array(ScoreFactorSchema),
  }).strict(),
]);

export type GetLeadOutput = z.infer<typeof GetLeadOutputSchema>;

export const GET_LEAD_DEFAULT_MAX_CHARS = 4000;

export type GetLeadToolOptions = {
  repository: LeadRepository;
  maxMessageChars?: number;
  now?: () => string;
};

function positiveLimit(value: number | undefined): number {
  return Number.isInteger(value) && value !== undefined && value > 0
    ? value
    : GET_LEAD_DEFAULT_MAX_CHARS;
}

function wrapMessage(message: string, maxChars: number): string {
  const safeMessage = message
    .replace(/<\/?lead_message\s*>/gi, "[lead-message tag]")
    .slice(0, maxChars);
  return `<lead_message>${safeMessage}</lead_message>`;
}

/** The Strands agent calls this read-only tool to retrieve one lead for assessment. */
export function createGetLeadTool(options: GetLeadToolOptions) {
  const maxMessageChars = positiveLimit(options.maxMessageChars);

  return tool({
    name: "get_lead",
    description: "Retrieve one lead by id, with its filter flags and deterministic score breakdown.",
    inputSchema: GetLeadInputSchema,
    callback: async ({ leadId }) => {
      const lead = await options.repository.getById(leadId);
      if (!lead) return GetLeadOutputSchema.parse({ status: "not_found", leadId });

      const allLeads = await options.repository.list();
      const filtered = filterLead(lead, { now: options.now?.() ?? new Date().toISOString(), batch: allLeads });
      const flags = filtered.status === "flagged"
        ? filtered.flags
        : filtered.status === "rejected"
          ? filtered.reasons
          : [];
      const scoring = scoreLead(lead, flags);
      // rawSourceData contains intake metadata, which is unnecessary for assessment and may include PII.
      const safeLead = {
        id: lead.id,
        source: lead.source,
        receivedAt: lead.receivedAt,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        property: lead.property,
        budget: lead.budget,
        timeline: lead.timeline,
        message: lead.message,
        engagement: lead.engagement,
      };
      const output = {
        status: "found" as const,
        lead: { ...safeLead, message: wrapMessage(lead.message, maxMessageChars) },
        flags,
        preScore: scoring.score,
        breakdown: scoring.breakdown,
      };
      return GetLeadOutputSchema.parse(output);
    },
  });
}