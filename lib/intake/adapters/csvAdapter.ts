import { INTAKE_LIMITS } from "../config";
import { normalizeLeadRecord } from "../normalize";
import type { IntakeAdapter, ParseResult } from "../types";

export type CsvHeaderMapping = Record<string, readonly string[]>;

export const DEFAULT_CSV_HEADER_MAPPING: CsvHeaderMapping = {
  id: ["id", "lead id", "lead_id"],
  name: ["name", "full name", "contact name", "buyer name"],
  email: ["email", "email address", "contact email", "buyer email"],
  phone: ["phone", "phone number", "mobile", "contact phone"],
  address: ["address", "street", "property address", "listing address"],
  city: ["city", "property city"],
  propertyType: ["property type", "home type", "type"],
  askingPrice: ["asking price", "list price", "price"],
  budget: ["budget", "budget range", "price range"],
  timeline: ["timeline", "timeframe", "move in", "move-in timeline"],
  message: ["message", "notes", "note", "comments", "inquiry"],
  receivedAt: ["received at", "received_at", "created at", "date"],
};

function parseCsvRows(input: string): { rows: string[][]; error?: string } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const value = input.replace(/^\uFEFF/, "");

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((entry) => entry.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) return { rows, error: "CSV contains an unterminated quoted field." };
  row.push(cell);
  if (row.some((entry) => entry.trim() !== "")) rows.push(row);
  return { rows };
}

function headerKey(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function createCsvAdapter(mapping: CsvHeaderMapping = DEFAULT_CSV_HEADER_MAPPING): IntakeAdapter {
  return {
    id: "csv",
    canHandle(input: unknown): boolean {
      return typeof input === "string";
    },
    async parse(input: unknown): Promise<ParseResult> {
      if (typeof input !== "string") return { leads: [], errors: [{ message: "CSV input must be text." }] };
      if (input.length === 0 || input.trim() === "") return { leads: [], errors: [] };
      if (Buffer.byteLength(input, "utf8") > INTAKE_LIMITS.maxRequestBytes) {
        return { leads: [], errors: [{ message: "CSV exceeds the configured size limit." }] };
      }

      const parsed = parseCsvRows(input);
      if (parsed.error) return { leads: [], errors: [{ row: 1, message: parsed.error }] };
      const [headers = [], ...rows] = parsed.rows;
      if (rows.length > INTAKE_LIMITS.maxCsvRows) {
        return { leads: [], errors: [{ message: "CSV exceeds the configured row limit." }] };
      }
      if (headers.length === 0 || rows.length === 0) return { leads: [], errors: [] };

      const normalizedHeaders = headers.map(headerKey);
      const canonicalHeaders = Object.entries(mapping).map(([field, alternatives]) => ({
        field,
        index: normalizedHeaders.findIndex((header) => [headerKey(field), ...alternatives.map(headerKey)].includes(header)),
      }));
      const leads: ParseResult["leads"] = [];
      const errors: ParseResult["errors"] = [];

      rows.forEach((cells, index) => {
        const rawRow: Record<string, unknown> = {};
        headers.forEach((header, column) => { rawRow[header] = cells[column] ?? ""; });
        const normalized: Record<string, unknown> = {};
        for (const header of canonicalHeaders) {
          if (header.index >= 0) normalized[header.field] = cells[header.index] ?? "";
        }
        const result = normalizeLeadRecord(normalized, "csv", rawRow);
        if (result.lead) leads.push(result.lead);
        else errors.push({ row: index + 2, message: result.error ?? "CSV row is invalid." });
      });
      return { leads, errors };
    },
  };
}

export const csvAdapter = createCsvAdapter();