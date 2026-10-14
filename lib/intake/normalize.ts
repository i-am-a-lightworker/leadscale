import { randomUUID } from "node:crypto";
import { LeadSchema, type Lead } from "../types/lead";
import { DEFAULT_CURRENCY } from "./config";

type RecordValue = Record<string, unknown>;

export function asRecord(value: unknown): RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : {};
}

function firstValue(record: RecordValue, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function normalizeEmail(value: unknown): string | undefined {
  const email = textValue(value)?.toLowerCase();
  return email || undefined;
}

export function normalizePhone(value: unknown): string | undefined {
  const raw = textValue(value);
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

function parseAmount(value: string): number | undefined {
  const match = value.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*([kKmM])?/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const multiplier = match[2]?.toLowerCase() === "k" ? 1_000 : match[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
  const result = amount * multiplier;
  return Number.isFinite(result) ? result : undefined;
}

export function parseBudget(value: unknown): Lead["budget"] {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return { min: value, max: value, currency: DEFAULT_CURRENCY };
  }

  if (typeof value === "string") {
    const amounts = [...value.matchAll(/\$?\s*\d[\d,]*(?:\.\d+)?\s*[kKmM]?/g)]
      .map(([amount]) => parseAmount(amount))
      .filter((amount): amount is number => amount !== undefined);
    if (amounts.length >= 2) {
      return { min: Math.min(amounts[0]!, amounts[1]!), max: Math.max(amounts[0]!, amounts[1]!), currency: DEFAULT_CURRENCY };
    }
    if (amounts.length === 1) return { min: amounts[0], max: amounts[0], currency: DEFAULT_CURRENCY };
    return { currency: DEFAULT_CURRENCY };
  }

  const budget = asRecord(value);
  const minimum = firstValue(budget, "min", "minimum", "budgetMin");
  const maximum = firstValue(budget, "max", "maximum", "budgetMax");
  const min = typeof minimum === "number" ? minimum : parseAmount(textValue(minimum) ?? "");
  const max = typeof maximum === "number" ? maximum : parseAmount(textValue(maximum) ?? "");
  const currencyValue = textValue(budget.currency)?.toUpperCase();
  const currency = currencyValue && /^[A-Z]{3}$/.test(currencyValue) ? currencyValue : DEFAULT_CURRENCY;
  return {
    ...(min !== undefined && min >= 0 ? { min } : {}),
    ...(max !== undefined && max >= 0 ? { max } : {}),
    currency,
  };
}

export function normalizeDate(value: unknown, fallback = new Date()): string {
  const date = value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

export function parseTimeline(value: unknown): Lead["timeline"] {
  const timeline = asRecord(value);
  const phrase = typeof value === "string"
    ? value
    : textValue(firstValue(timeline, "urgency", "timeframe", "timeline")) ?? "";
  const normalized = phrase.toLowerCase();
  let urgency: Lead["timeline"]["urgency"];
  if (/\b(asap|immediate|right away|now)\b/.test(normalized)) urgency = "IMMEDIATE";
  else if (/\b(30 days|one month|within a month|this month)\b/.test(normalized)) urgency = "WITHIN_30_DAYS";
  else if (/\b(3 months|90 days|quarter|this season|spring|summer|fall|autumn|winter)\b/.test(normalized)) urgency = "WITHIN_3_MONTHS";
  else if (/\b(flexible|not sure|someday|no rush|open)\b/.test(normalized)) urgency = "FLEXIBLE";
  else if (phrase === "IMMEDIATE" || phrase === "WITHIN_30_DAYS" || phrase === "WITHIN_3_MONTHS" || phrase === "FLEXIBLE") urgency = phrase;

  const targetMoveDate = firstValue(timeline, "targetMoveDate", "moveDate", "target_date");
  const result: Lead["timeline"] = {};
  if (urgency) result.urgency = urgency;
  if (typeof targetMoveDate === "string" && !Number.isNaN(Date.parse(targetMoveDate))) {
    result.targetMoveDate = normalizeDate(targetMoveDate);
  }
  return result;
}

function numericCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

export function normalizeLeadRecord(
  input: unknown,
  source: string,
  rawSourceData: RecordValue = asRecord(input),
): { lead?: Lead; error?: string } {
  const record = asRecord(input);
  const propertyRecord = asRecord(firstValue(record, "property", "listing"));
  const engagementRecord = asRecord(record.engagement);
  const receivedAt = normalizeDate(firstValue(record, "receivedAt", "received_at", "createdAt", "date"));
  const name = textValue(firstValue(record, "name", "fullName", "contactName", "buyerName"));
  const email = normalizeEmail(firstValue(record, "email", "contactEmail", "buyerEmail"));
  const phone = normalizePhone(firstValue(record, "phone", "contactPhone", "buyerPhone"));
  const askingPriceValue = firstValue(propertyRecord, "askingPrice", "asking_price") ?? firstValue(record, "askingPrice", "asking_price");
  const askingPrice = typeof askingPriceValue === "number" ? askingPriceValue : parseAmount(textValue(askingPriceValue) ?? "");
  const address = textValue(firstValue(propertyRecord, "address", "street", "addressLine")) ?? textValue(firstValue(record, "address", "street"));
  const city = textValue(firstValue(propertyRecord, "city")) ?? textValue(record.city);
  const propertyType = textValue(firstValue(propertyRecord, "propertyType", "type", "property_type")) ?? textValue(firstValue(record, "propertyType", "property_type"));
  const messageValue = firstValue(record, "message", "notes", "note", "comments");
  const candidate: unknown = {
    id: textValue(record.id) ?? randomUUID(),
    source,
    receivedAt,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    property: {
      ...(address ? { address } : {}),
      ...(city ? { city } : {}),
      ...(propertyType ? { propertyType } : {}),
      ...(askingPrice !== undefined && askingPrice >= 0 ? { askingPrice } : {}),
    },
    budget: parseBudget(firstValue(record, "budget", "budgetRange", "budget_range", "priceRange")),
    timeline: parseTimeline(firstValue(record, "timeline", "timeframe", "moveIn")),
    message: typeof messageValue === "string" ? messageValue : "",
    engagement: {
      replyCount: numericCount(firstValue(engagementRecord, "replyCount", "reply_count")),
      viewCount: numericCount(firstValue(engagementRecord, "viewCount", "view_count")),
      tourRequestCount: numericCount(firstValue(engagementRecord, "tourRequestCount", "tour_request_count")),
      ...(typeof engagementRecord.lastActivityAt === "string" ? { lastActivityAt: normalizeDate(engagementRecord.lastActivityAt) } : {}),
      ...(typeof engagementRecord.previousActivityAt === "string" ? { previousActivityAt: normalizeDate(engagementRecord.previousActivityAt) } : {}),
    },
    rawSourceData,
  };
  const parsed = LeadSchema.safeParse(candidate);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "lead"}: ${issue.message}`)
      .join("; ");
    return { error: message };
  }
  return { lead: parsed.data };
}