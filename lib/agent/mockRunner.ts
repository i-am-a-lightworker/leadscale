import { priorityFromScore, type Assessment } from "../types/lead";
import type { ModelRunner } from "./agent";

const MOCK_ACTIONS = {
  LOW: "The assigned agent should ask the lead for a budget and buying timeline by the next business day.",
  MEDIUM: "The assigned agent should confirm the lead's property criteria by the next business day.",
  HIGH: "The assigned agent should contact the lead today to confirm the next step.",
  URGENT: "The assigned agent should contact the lead today to arrange the requested next step.",
} as const;

export const mockModelRunner: ModelRunner = async (input): Promise<Assessment> => {
  const priority = priorityFromScore(input.preScore);
  const reasons = input.breakdown
    .filter((factor) => factor.points > 0)
    .sort((left, right) => right.points - left.points)
    .slice(0, 2)
    .map((factor) => factor.note);
  while (reasons.length < 2) reasons.push(`Deterministic pre-score is ${input.preScore} out of 100.`);

  return {
    score: input.preScore,
    priority,
    reasons,
    recommendedAction: MOCK_ACTIONS[priority],
    missingInformation: input.missingInformation,
    confidence: "HIGH",
  };
};