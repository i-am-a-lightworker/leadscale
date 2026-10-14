import {
  AssessmentSchema,
  priorityFromScore,
  type Assessment,
  type Lead,
} from "../types/lead";
import { deriveConfidence, deriveMissingInformation, scoreLead } from "./scoring";
import type { ScoreBreakdown } from "./scoring";

export const ASSESSMENT_GOVERNANCE_CONFIG = {
  scoreAdjustmentLimit: 10,
  maxReasons: 3,
} as const;

export const FAIR_HOUSING_DENYLIST = [
  "race",
  "religion",
  "national origin",
  "disability",
  "familial status",
    "family status",
  "marital status",
  "sexual orientation",
  "gender identity",
] as const;

export class AssessmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssessmentValidationError";
  }
}

export type ValidatedAssessment = { assessment: Assessment; adjustments: string[] };

function parseRaw(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed: unknown = JSON.parse(unfenced);
    return parsed;
  } catch {
    throw new AssessmentValidationError("Model output was not valid JSON.");
  }
}

function withAtMostThreeReasons(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const candidate = raw as Record<string, unknown>;
  if (!Array.isArray(candidate.reasons)) return raw;
  return { ...candidate, reasons: candidate.reasons.slice(0, ASSESSMENT_GOVERNANCE_CONFIG.maxReasons) };
}

function assertSafeText(assessment: Assessment): void {
  const text = [
    ...assessment.reasons,
    assessment.recommendedAction,
    ...assessment.missingInformation,
  ].join("\n");
  const normalized = text.toLowerCase();

  for (const term of FAIR_HOUSING_DENYLIST) {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z])${escapedTerm}([^a-z]|$)`, "i").test(normalized)) {
      throw new AssessmentValidationError("Assessment contains a disallowed fair-housing inference term.");
    }
  }

  const injectionPatterns = [
    /\b(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions\b/i,
    /\b(?:rate|mark)\s+(?:this\s+)?(?:lead\s+)?(?:as\s+)?urgent\b/i,
    /\bscore\s+(?:of\s+)?100\b/i,
    /\b(?:follow|obey)\s+(?:the|these)\s+instructions\b/i,
  ];
  if (injectionPatterns.some((pattern) => pattern.test(text))) {
    throw new AssessmentValidationError("Assessment appears to follow instructions embedded in lead data.");
  }
}

function mergeMissingInformation(modelMissing: string[], derivedMissing: string[]): string[] {
  const unique = new Map<string, string>();
  for (const item of [...modelMissing, ...derivedMissing]) {
    const normalized = item.trim();
    if (normalized && !unique.has(normalized.toLowerCase())) unique.set(normalized.toLowerCase(), normalized);
  }
  return [...unique.values()];
}

const confidenceRank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

export function validateAndConstrain(
  raw: unknown,
  preScore: number,
  lead: Lead,
  flags: readonly string[] = [],
  breakdown: ScoreBreakdown = scoreLead(lead, flags).breakdown,
): ValidatedAssessment {
  const candidate = withAtMostThreeReasons(parseRaw(raw));
  const parsed = AssessmentSchema.safeParse(candidate);
  if (!parsed.success) throw new AssessmentValidationError("Model output did not match the Assessment contract.");

  assertSafeText(parsed.data);
  const adjustments: string[] = [];
  const minimumScore = Math.max(0, preScore - ASSESSMENT_GOVERNANCE_CONFIG.scoreAdjustmentLimit);
  const maximumScore = Math.min(100, preScore + ASSESSMENT_GOVERNANCE_CONFIG.scoreAdjustmentLimit);
  const constrainedScore = Math.max(minimumScore, Math.min(maximumScore, parsed.data.score));
  if (constrainedScore !== parsed.data.score) {
    adjustments.push(`Score clamped from ${parsed.data.score} to ${constrainedScore} within +/-${ASSESSMENT_GOVERNANCE_CONFIG.scoreAdjustmentLimit} of the deterministic pre-score.`);
  }

  const priority = priorityFromScore(constrainedScore);
  if (priority !== parsed.data.priority) adjustments.push(`Priority recomputed from ${parsed.data.priority} to ${priority} using the final score.`);

  const derivedConfidence = deriveConfidence(lead, flags, breakdown);
  const confidence = confidenceRank[parsed.data.confidence] <= confidenceRank[derivedConfidence]
    ? parsed.data.confidence
    : derivedConfidence;
  if (confidence !== parsed.data.confidence) {
    adjustments.push(`Confidence lowered from ${parsed.data.confidence} to ${confidence} using deterministic evidence.`);
  }

  const assessment = AssessmentSchema.parse({
    ...parsed.data,
    score: constrainedScore,
    priority,
    confidence,
    missingInformation: mergeMissingInformation(parsed.data.missingInformation, deriveMissingInformation(lead)),
  });
  return { assessment, adjustments };
}