import {
  AssessmentSchema,
  priorityFromScore,
  type Assessment,
  type Lead,
} from "../types/lead";
import { deriveConfidence, deriveMissingInformation } from "./scoring";
import type { ScoreBreakdown } from "./scoring";

const FALLBACK_ACTIONS = {
  LOW: "The assigned agent should request the lead's missing budget and timeline details within one business day.",
  MEDIUM: "The assigned agent should clarify the lead's property criteria and next step by the end of the next business day.",
  HIGH: "The assigned agent should contact the lead today to confirm requirements and availability.",
  URGENT: "The assigned agent should contact the lead today to confirm the requested next step.",
} as const;

export function buildFallbackAssessment(
  lead: Lead,
  preScore: number,
  breakdown: ScoreBreakdown,
  flags: readonly string[],
): Assessment {
  const priority = priorityFromScore(preScore);
  const leadingFactors = [...breakdown]
    .sort((left, right) => right.points - left.points)
    .map((factor) => factor.note.trim())
    .filter(Boolean);
  const reasons = [...new Set(leadingFactors)].slice(0, 2);
  while (reasons.length < 2) reasons.push(`Deterministic pre-score is ${preScore} out of 100.`);
  if (flags.some((flag) => flag.startsWith("CONFLICT:")) && !reasons.some((reason) => reason.toLowerCase().includes("conflict"))) {
    reasons[1] = "A conflicting-data flag requires clarification before recommending the property.";
  }

  return AssessmentSchema.parse({
    score: preScore,
    priority,
    reasons,
    recommendedAction: FALLBACK_ACTIONS[priority],
    missingInformation: deriveMissingInformation(lead),
    confidence: deriveConfidence(lead, flags, breakdown),
  });
}