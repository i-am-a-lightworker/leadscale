import { normalizeLeadRecord, asRecord } from "../normalize";
import type { IntakeAdapter, ParseResult } from "../types";

function recordsFromInput(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  const record = asRecord(input);
  if (Array.isArray(record.leads)) return record.leads;
  if (Object.keys(record).length === 0) return [];
  return [input];
}

export const manualAdapter: IntakeAdapter = {
  id: "manual",
  canHandle(input: unknown): boolean {
    return Array.isArray(input) || (typeof input === "object" && input !== null);
  },
  async parse(input: unknown): Promise<ParseResult> {
    const records = recordsFromInput(input);
    const leads: ParseResult["leads"] = [];
    const errors: ParseResult["errors"] = [];
    records.forEach((record, index) => {
      const result = normalizeLeadRecord(record, "manual", asRecord(record));
      if (result.lead) leads.push(result.lead);
      else errors.push({ row: index + 1, message: result.error ?? "Manual lead is invalid." });
    });
    return { leads, errors };
  },
};