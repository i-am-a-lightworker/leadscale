import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone, parseBudget, parseTimeline } from "../lib/intake/normalize";

describe("intake normalization", () => {
  it.each([
    ["$450k", { min: 450_000, max: 450_000, currency: "USD" }],
    ["450,000-525,000", { min: 450_000, max: 525_000, currency: "USD" }],
    ["$1.2m", { min: 1_200_000, max: 1_200_000, currency: "USD" }],
    ["unknown", { currency: "USD" }],
  ])("parses budget %s", (input, expected) => {
    expect(parseBudget(input)).toEqual(expected);
  });

  it.each([
    ["(512) 555-0199", "+15125550199"],
    ["1-512-555-0199", "+15125550199"],
    ["+44 20 7946 0958", "+442079460958"],
    ["not a phone", undefined],
  ])("normalizes phone %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ["ASAP", "IMMEDIATE"],
    ["within 30 days", "WITHIN_30_DAYS"],
    ["in 3 months", "WITHIN_3_MONTHS"],
    ["no rush", "FLEXIBLE"],
  ])("parses timeline %s", (input, urgency) => {
    expect(parseTimeline(input).urgency).toBe(urgency);
  });

  it("trims and lowercases email addresses", () => {
    expect(normalizeEmail("  BUYER@Example.COM ")).toBe("buyer@example.com");
  });
});