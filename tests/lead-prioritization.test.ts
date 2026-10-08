import { describe, expect, it } from "vitest";
import { AssessmentSchema, LeadSchema, type Lead } from "../lib/types/lead";
import { filterLead, filterLeads } from "../lib/filtering/leadFilter";
import { deriveConfidence, deriveMissingInformation, scoreLead } from "../lib/agent/scoring";

const strongLead = LeadSchema.parse({
  id: "strong",
  source: "manual",
  receivedAt: "2026-10-07T12:00:00Z",
  name: "Jordan Lee",
  email: "jordan@example.com",
  phone: "+1 (555) 010-1000",
  property: { address: "14 Oak Street", city: "Austin", propertyType: "House", askingPrice: 625000 },
  budget: { min: 600000, max: 650000, currency: "USD" },
  timeline: { urgency: "WITHIN_30_DAYS", targetMoveDate: "2026-10-20T00:00:00Z" },
  message: "We are pre-approved and would like to tour 14 Oak Street Saturday. How many bedrooms?",
  engagement: {
    replyCount: 2,
    viewCount: 3,
    tourRequestCount: 1,
    lastActivityAt: "2026-10-07T11:00:00Z",
    previousActivityAt: "2026-10-06T11:00:00Z",
  },
  rawSourceData: {},
});

const weakLead = LeadSchema.parse({
  id: "weak",
  source: "csv",
  receivedAt: "2026-10-07T12:00:00Z",
  name: "Alex Morgan",
  email: "alex@example.org",
  property: {},
  budget: { currency: "USD" },
  timeline: {},
  message: "Maybe I am interested someday.",
  engagement: { replyCount: 0, viewCount: 0, tourRequestCount: 0 },
  rawSourceData: {},
});

const incompleteLead = LeadSchema.parse({
  ...weakLead,
  id: "incomplete",
  name: "Taylor Reed",
  email: undefined,
  phone: "555-010-3000",
  message: "",
  property: {},
});

const conflictingLead = LeadSchema.parse({
  ...strongLead,
  id: "conflicting",
  budget: { min: 200000, max: 250000, currency: "USD" },
});

const duplicateLead = LeadSchema.parse({
  ...strongLead,
  id: "duplicate",
  receivedAt: "2026-10-06T12:00:00Z",
  email: " JORDAN@EXAMPLE.COM ",
  phone: "15550101000",
});

const reengagedLead = LeadSchema.parse({
  ...weakLead,
  id: "re-engaged",
  engagement: {
    replyCount: 1,
    viewCount: 0,
    tourRequestCount: 0,
    previousActivityAt: "2026-08-01T12:00:00Z",
    lastActivityAt: "2026-10-07T11:00:00Z",
  },
});

const validAssessment = {
  score: 90,
  priority: "URGENT",
  reasons: ["Requested a tour for 14 Oak Street.", "Budget covers the asking price."],
  recommendedAction: "The assigned agent should confirm a tour time by 5 p.m. today.",
  missingInformation: [],
  confidence: "HIGH",
} as const;

function asLead(overrides: Partial<Lead> = {}): Lead {
  return LeadSchema.parse({ ...weakLead, ...overrides });
}

describe("lead and assessment schemas", () => {
  it("accepts a valid assessment", () => {
    expect(AssessmentSchema.safeParse(validAssessment).success).toBe(true);
  });

  it("rejects score 101, an invalid priority, reason counts outside 2-3, and empty action", () => {
    expect(AssessmentSchema.safeParse({ ...validAssessment, score: 101 }).success).toBe(false);
    expect(AssessmentSchema.safeParse({ ...validAssessment, reasons: ["Only one"] }).success).toBe(false);
    expect(
      AssessmentSchema.safeParse({
        ...validAssessment,
        reasons: ["One", "Two", "Three", "Four"],
      }).success,
    ).toBe(false);
    expect(AssessmentSchema.safeParse({ ...validAssessment, recommendedAction: " " }).success).toBe(false);
    expect(AssessmentSchema.safeParse({ ...validAssessment, priority: "TOP" }).success).toBe(false);
  });

  it("rejects a lead without an email or phone", () => {
    expect(
      LeadSchema.safeParse({
        ...weakLead,
        email: undefined,
        phone: undefined,
      }).success,
    ).toBe(false);
  });
});

describe("lead filtering", () => {
  it("rejects schema-invalid input", () => {
    expect(filterLead({ ...weakLead, budget: { currency: "US" } }).status).toBe("rejected");
  });

  it("rejects a lead with no contact method", () => {
    const result = filterLead({ ...weakLead, email: undefined, phone: undefined });
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.reasons).toContain("Lead has no usable email address or phone number.");
    }
  });

  it("rejects obvious test, gibberish, and empty unusable records", () => {
    expect(filterLead(asLead({ email: "test@test.com" })).status).toBe("rejected");
    expect(filterLead(asLead({ message: "asdfghjkl" })).status).toBe("rejected");
    expect(filterLead(asLead({ message: "", property: {} })).status).toBe("rejected");
  });

  it("rejects a lead received in the future", () => {
    const result = filterLead(strongLead, { now: "2026-10-06T12:00:00Z" });
    expect(result.status).toBe("rejected");
  });

  it("flags duplicates and keeps the most recent duplicate as primary", () => {
    const results = filterLeads([duplicateLead, strongLead], { now: "2026-10-07T13:00:00Z" });
    expect(results[0]?.status).toBe("flagged");
    expect(results[1]?.status).toBe("eligible");
    if (results[0]?.status === "flagged") {
      expect(results[0].flags).toContain("DUPLICATE: Duplicate of primary lead strong.");
    }
  });

  it("flags a budget far below the property asking price", () => {
    const result = filterLead(conflictingLead, { now: conflictingLead.receivedAt });
    expect(result.status).toBe("flagged");
    if (result.status === "flagged") {
      expect(result.flags.some((flag) => flag.startsWith("CONFLICT:"))).toBe(true);
    }
  });

  it("flags stale leads and recently re-engaged leads using the injected reference time", () => {
    const staleResult = filterLead(weakLead, { now: "2026-11-01T12:00:00Z" });
    const reengagedResult = filterLead(reengagedLead, { now: "2026-10-07T12:00:00Z" });
    expect(staleResult.status).toBe("flagged");
    expect(reengagedResult.status).toBe("flagged");
  });
});

describe("deterministic lead scoring", () => {
  it("scores the strong lead higher than the weak lead", () => {
    expect(scoreLead(strongLead).score).toBeGreaterThan(scoreLead(weakLead).score);
  });

  it("always returns an integer score from 0 through 100", () => {
    for (const lead of [strongLead, weakLead, incompleteLead, conflictingLead, duplicateLead, reengagedLead]) {
      const { score } = scoreLead(lead);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("returns the same score and breakdown for the same input", () => {
    expect(scoreLead(strongLead)).toEqual(scoreLead(strongLead));
  });

  it("derives missing information and confidence from explicit evidence", () => {
    const scoring = scoreLead(incompleteLead);
    expect(deriveMissingInformation(incompleteLead)).toContain("Target budget");
    expect(deriveConfidence(incompleteLead, [], scoring.breakdown)).toBe("LOW");
    const completeScoring = scoreLead(strongLead);
    expect(deriveConfidence(strongLead, [], completeScoring.breakdown)).toBe("HIGH");
  });
});
