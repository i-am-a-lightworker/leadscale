import { INTAKE_LIMITS } from "../config";
import { asRecord, normalizeLeadRecord } from "../normalize";
import type { IntakeAdapter, ParseResult } from "../types";

type EmailInput = {
  subject: string;
  from: string;
  text: string;
  html: string;
  receivedAt: string;
  providerEmailId: string;
  rawSourceData: Record<string, unknown>;
};

type EmailParser = {
  id: string;
  matches(subject: string): boolean;
  extract(input: EmailInput, text: string): Record<string, unknown>;
};

function decodeEntities(value: string): string {
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code);
      return point <= 0x10ffff ? String.fromCodePoint(point) : "\uFFFD";
    })
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => {
      const point = Number.parseInt(code, 16);
      return point <= 0x10ffff ? String.fromCodePoint(point) : "\uFFFD";
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => entities[name.toLowerCase()] ?? match);
}

export function stripHtmlToText(html: string): string {
  return decodeEntities(html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|iframe|object|svg)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>|<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function extractLabel(text: string, labels: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${labels})\\s*[:\\-]\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim();
}

function extractPipeField(text: string, label: string): string | undefined {
  const line = text.split("\n").find((entry) => entry.toLowerCase().startsWith(`${label.toLowerCase()} |`));
  return line?.slice(line.indexOf("|") + 1).trim() || undefined;
}

function genericParser(input: EmailInput, text: string): Record<string, unknown> {
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
  const phone = text.match(/(?:\+?\d[\d ().-]{6,}\d)/)?.[0];
  return {
    id: input.providerEmailId,
    name: extractLabel(text, "name|contact|buyer|lead") ?? (email ? email.split("@")[0] : undefined),
    email: extractLabel(text, "email|e-mail") ?? email,
    phone: extractLabel(text, "phone|mobile|tel") ?? phone,
    address: extractLabel(text, "property address|address|listing"),
    city: extractLabel(text, "city"),
    propertyType: extractLabel(text, "property type|home type"),
    budget: extractLabel(text, "budget|price range"),
    timeline: extractLabel(text, "timeline|timeframe|move-in"),
    message: text,
    receivedAt: input.receivedAt,
  };
}

const emailParsers: readonly EmailParser[] = [
  {
    // TODO(verify): Real forwarded listing formats are unknown; this labeled parser is fictional.
    id: "fictional-home-alert",
    matches: (subject) => subject.toLowerCase().startsWith("[fictional home alert]"),
    extract: (input, text) => ({
      ...genericParser(input, text),
      name: extractLabel(text, "buyer name") ?? extractLabel(text, "name"),
      email: extractLabel(text, "buyer email") ?? extractLabel(text, "email"),
      phone: extractLabel(text, "buyer phone") ?? extractLabel(text, "phone"),
      address: extractLabel(text, "listing address"),
      sourceFormat: "fictional-home-alert",
    }),
  },
  {
    // TODO(verify): Real forwarded listing formats are unknown; this labeled parser is fictional.
    id: "fictional-buyer-inquiry",
    matches: (subject) => subject.toLowerCase().startsWith("fictional: new buyer inquiry"),
    extract: (input, text) => ({
      ...genericParser(input, text),
      name: extractPipeField(text, "Contact Name"),
      email: extractPipeField(text, "Contact Email"),
      phone: extractPipeField(text, "Contact Phone"),
      address: extractPipeField(text, "Listing Address"),
      budget: extractPipeField(text, "Budget"),
      timeline: extractPipeField(text, "Timeline"),
      sourceFormat: "fictional-buyer-inquiry",
    }),
  },
  {
    id: "generic",
    matches: () => true,
    extract: genericParser,
  },
];

function parseInput(input: unknown): EmailInput | undefined {
  const record = asRecord(input);
  const hasPayload = ["subject", "from", "text", "html", "providerEmailId", "id"]
    .some((key) => typeof record[key] === "string" && (record[key] as string).trim() !== "");
  if (!hasPayload) return undefined;
  const rawSourceData = Object.keys(asRecord(record.rawSourceData)).length > 0
    ? asRecord(record.rawSourceData)
    : record;
  const text = typeof record.text === "string" ? record.text : "";
  const html = typeof record.html === "string" ? record.html : "";
  const providerEmailId = typeof record.providerEmailId === "string" ? record.providerEmailId : typeof record.id === "string" ? record.id : "email-forward";
  if (text.length + html.length > INTAKE_LIMITS.maxEmailBodyChars) return undefined;
  return {
    subject: typeof record.subject === "string" ? record.subject : "",
    from: typeof record.from === "string" ? record.from : "",
    text,
    html,
    receivedAt: typeof record.receivedAt === "string" ? record.receivedAt : new Date().toISOString(),
    providerEmailId,
    rawSourceData,
  };
}

export const emailForwardAdapter: IntakeAdapter = {
  id: "email-forward",
  canHandle(input: unknown): boolean {
    return typeof input === "object" && input !== null && !Array.isArray(input);
  },
  async parse(input: unknown): Promise<ParseResult> {
    const parsedInput = parseInput(input);
    if (!parsedInput) {
      const record = asRecord(input);
      return Object.keys(record).length === 0
        ? { leads: [], errors: [] }
        : { leads: [], errors: [{ message: "Email payload is empty or exceeds the configured content limit." }] };
    }
    try {
      const text = parsedInput.text || stripHtmlToText(parsedInput.html);
      const parser = emailParsers.find((candidate) => candidate.matches(parsedInput.subject)) ?? emailParsers[emailParsers.length - 1]!;
      const normalized = parser.extract(parsedInput, text);
      const result = normalizeLeadRecord(normalized, "email-forward", parsedInput.rawSourceData);
      return result.lead
        ? { leads: [result.lead], errors: [] }
        : { leads: [], errors: [{ row: 1, message: result.error ?? `Email could not be parsed by ${parser.id}.` }] };
    } catch {
      return { leads: [], errors: [{ row: 1, message: "Email payload could not be parsed safely." }] };
    }
  },
};