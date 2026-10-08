import type { Lead } from "../types/lead";

export const SCORING_CONFIG = {
  weights: {
    timelineUrgency: 20,
    budgetFit: 25,
    engagementRecency: 20,
    intentSignals: 25,
    contactCompleteness: 10,
  },
  thresholds: {
    urgentTimelineDays: 14,
    nearTermTimelineDays: 45,
    recentActivityDays: 30,
    maxCountContribution: 3,
    budgetConflictFitRatio: 0.7,
  },
  fractions: {
    nearTermTimeline: 0.8,
    longerTimeline: 0.55,
    completeBudgetRange: 0.65,
    partialBudgetRange: 0.4,
    nearAskingPriceFit: 0.5,
    intentBase: 0.5,
    additionalIntentSignal: 0.25,
    engagementCountShare: 0.5,
    engagementRecencyShare: 0.5,
    olderActivityRecency: 0.5,
  },
  timelineFractions: {
    IMMEDIATE: 1,
    WITHIN_30_DAYS: 0.8,
    WITHIN_3_MONTHS: 0.55,
    FLEXIBLE: 0.25,
  },
  penalties: {
    duplicate: 15,
    conflictingData: 20,
    stale: 10,
  },
  intentPhrases: {
    tourRequest: ["tour", "showing", "view the property"],
    preApproval: ["pre-approved", "preapproved", "pre-approval"],
    propertyQuestion: ["how many", "does the property", "is the home", "what is the"],
  },
} as const;

export type ScoreFactor = {
  factor: string;
  points: number;
  note: string;
};

export type ScoreBreakdown = ScoreFactor[];

export type ScoreResult = {
  score: number;
  breakdown: ScoreBreakdown;
};

function daysBetween(earlier: string, later: string): number {
  return (Date.parse(later) - Date.parse(earlier)) / (24 * 60 * 60 * 1000);
}

function scoreTimeline(lead: Lead): ScoreFactor {
  let fraction = lead.timeline.urgency
    ? SCORING_CONFIG.timelineFractions[lead.timeline.urgency]
    : 0;
  let note = lead.timeline.urgency
    ? `Lead-stated timeline is ${lead.timeline.urgency.toLowerCase().replaceAll("_", " ")}.`
    : "No buying urgency is stated.";

  if (lead.timeline.targetMoveDate) {
    const daysUntilMove = daysBetween(lead.receivedAt, lead.timeline.targetMoveDate);
    const dateFraction =
      daysUntilMove <= SCORING_CONFIG.thresholds.urgentTimelineDays
        ? 1
        : daysUntilMove <= SCORING_CONFIG.thresholds.nearTermTimelineDays
          ? SCORING_CONFIG.fractions.nearTermTimeline
          : SCORING_CONFIG.fractions.longerTimeline;
    if (dateFraction > fraction) fraction = dateFraction;
    note = `Target move date is ${lead.timeline.targetMoveDate}.`;
  }

  return {
    factor: "Timeline urgency",
    points: Math.round(SCORING_CONFIG.weights.timelineUrgency * fraction),
    note,
  };
}

function scoreBudgetFit(lead: Lead): ScoreFactor {
  const budget = lead.budget;
  const askingPrice = lead.property.askingPrice;
  let fraction = 0;
  let note = "Budget range or property asking price is missing.";

  if (budget.min !== undefined && budget.max !== undefined) {
    fraction = SCORING_CONFIG.fractions.completeBudgetRange;
    note = `Budget range is ${budget.min}-${budget.max} ${budget.currency}.`;
  } else if (budget.min !== undefined || budget.max !== undefined) {
    fraction = SCORING_CONFIG.fractions.partialBudgetRange;
    note = `Partial budget information is available in ${budget.currency}.`;
  }

  if (askingPrice !== undefined && budget.max !== undefined) {
    if (budget.max < askingPrice * SCORING_CONFIG.thresholds.budgetConflictFitRatio) {
      fraction = 0;
      note = `Budget maximum ${budget.max} ${budget.currency} is far below asking price ${askingPrice}.`;
    } else if (budget.max >= askingPrice && (budget.min === undefined || budget.min <= askingPrice)) {
      fraction = 1;
      note = `Budget range covers the ${askingPrice} ${budget.currency} asking price.`;
    } else {
      fraction = Math.max(fraction, SCORING_CONFIG.fractions.nearAskingPriceFit);
      note = `Budget maximum is near the ${askingPrice} ${budget.currency} asking price.`;
    }
  }

  return {
    factor: "Budget clarity and property fit",
    points: Math.round(SCORING_CONFIG.weights.budgetFit * fraction),
    note,
  };
}

function scoreEngagement(lead: Lead, flags: readonly string[]): ScoreFactor {
  const engagement = lead.engagement;
  const interactions = engagement.replyCount + engagement.viewCount + engagement.tourRequestCount;
  const countFraction = Math.min(interactions, SCORING_CONFIG.thresholds.maxCountContribution) /
    SCORING_CONFIG.thresholds.maxCountContribution;
  const activityDate = engagement.lastActivityAt;
  let recencyFraction = 0;

  if (activityDate) {
    const ageInDays = daysBetween(activityDate, lead.receivedAt);
    if (ageInDays <= SCORING_CONFIG.thresholds.recentActivityDays) recencyFraction = 1;
    else recencyFraction = SCORING_CONFIG.fractions.olderActivityRecency;
  }
  if (flags.some((flag) => flag.startsWith("REENGAGED:"))) recencyFraction = 1;

  const fraction =
    countFraction * SCORING_CONFIG.fractions.engagementCountShare +
    recencyFraction * SCORING_CONFIG.fractions.engagementRecencyShare;
  return {
    factor: "Engagement and recency",
    points: Math.round(SCORING_CONFIG.weights.engagementRecency * fraction),
    note: `${engagement.replyCount} replies, ${engagement.viewCount} views, and ${engagement.tourRequestCount} tour requests.`,
  };
}

function includesAny(message: string, phrases: readonly string[]): boolean {
  const normalizedMessage = message.toLowerCase();
  return phrases.some((phrase) => normalizedMessage.includes(phrase));
}

function scoreIntent(lead: Lead): ScoreFactor {
  const signals = [
    includesAny(lead.message, SCORING_CONFIG.intentPhrases.tourRequest),
    includesAny(lead.message, SCORING_CONFIG.intentPhrases.preApproval),
    includesAny(lead.message, SCORING_CONFIG.intentPhrases.propertyQuestion),
  ];
  const count = signals.filter(Boolean).length;
  const fraction =
    count === 0
      ? 0
      : Math.min(
          SCORING_CONFIG.fractions.intentBase +
            (count - 1) * SCORING_CONFIG.fractions.additionalIntentSignal,
          1,
        );
  const signalNames = ["tour request", "pre-approval", "specific property question"];
  const matchedSignals = signalNames.filter((_, index) => signals[index]);

  return {
    factor: "Intent signals",
    points: Math.round(SCORING_CONFIG.weights.intentSignals * fraction),
    note: matchedSignals.length > 0 ? `Message includes ${matchedSignals.join(", ")}.` : "No clear intent signal in the message.",
  };
}

function scoreContactCompleteness(lead: Lead): ScoreFactor {
  const contactCount = Number(Boolean(lead.email)) + Number(Boolean(lead.phone));
  const fraction = contactCount / 2;
  return {
    factor: "Contact completeness",
    points: Math.round(SCORING_CONFIG.weights.contactCompleteness * fraction),
    note: contactCount === 2 ? "Both email and phone are present." : "One contact method is present.",
  };
}

function flagPenalty(flags: readonly string[], prefix: string, penalty: number, factor: string, note: string): ScoreFactor {
  const applies = flags.some((flag) => flag.startsWith(prefix));
  return { factor, points: applies ? -penalty : 0, note: applies ? note : `No ${factor.toLowerCase()} flag.` };
}

export function scoreLead(lead: Lead, flags: readonly string[] = []): ScoreResult {
  const breakdown: ScoreBreakdown = [
    scoreTimeline(lead),
    scoreBudgetFit(lead),
    scoreEngagement(lead, flags),
    scoreIntent(lead),
    scoreContactCompleteness(lead),
    flagPenalty(flags, "DUPLICATE:", SCORING_CONFIG.penalties.duplicate, "Duplicate penalty", "Lead is a duplicate of a newer primary."),
    flagPenalty(flags, "CONFLICT:", SCORING_CONFIG.penalties.conflictingData, "Conflicting data penalty", "Budget conflicts with the property asking price."),
    flagPenalty(flags, "STALE:", SCORING_CONFIG.penalties.stale, "Stale lead penalty", "Lead is beyond the configured freshness threshold."),
  ];
  const score = Math.max(0, Math.min(100, Math.round(breakdown.reduce((total, factor) => total + factor.points, 0))));
  return { score, breakdown };
}

export function deriveMissingInformation(lead: Lead): string[] {
  const missing: string[] = [];
  if (lead.budget.min === undefined && lead.budget.max === undefined) missing.push("Target budget");
  if (!lead.timeline.urgency && !lead.timeline.targetMoveDate) missing.push("Buying timeline");
  if (
    lead.property.askingPrice === undefined &&
    !lead.property.address &&
    !lead.property.city &&
    !lead.property.propertyType
  ) {
    missing.push("Property of interest");
  }
  if (!lead.message.trim()) missing.push("Buying intent");
  return missing;
}

export function deriveConfidence(
  lead: Lead,
  flags: readonly string[],
  breakdown: ScoreBreakdown,
): "LOW" | "MEDIUM" | "HIGH" {
  if (flags.some((flag) => flag.startsWith("CONFLICT:"))) return "LOW";
  const intentPoints = breakdown.find((factor) => factor.factor === "Intent signals")?.points ?? 0;
  const budgetIsClear = lead.budget.max !== undefined;
  const timelineIsClear = Boolean(lead.timeline.urgency || lead.timeline.targetMoveDate);
  const intentIsClear = intentPoints > 0;

  if (!budgetIsClear || !timelineIsClear || !intentIsClear) return "LOW";
  if (flags.some((flag) => flag.startsWith("DUPLICATE:") || flag.startsWith("STALE:"))) return "MEDIUM";
  return "HIGH";
}
