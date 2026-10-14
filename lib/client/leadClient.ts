import { LeadSchema, type Lead } from "../types/lead";
import {
  fixtureLeads,
  fixturePrioritizeResult,
  PrioritizeResultSchema,
  type PrioritizeResult,
} from "./fixtures";

export class LeadClientError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "http" | "validation",
  ) {
    super(message);
    this.name = "LeadClientError";
  }
}

const useFixtures = process.env.NEXT_PUBLIC_USE_FIXTURES !== "false";

function validationMessage(
  resource: string,
  error: { issues: { message: string; path: PropertyKey[] }[] },
): string {
  const issue = error.issues[0];
  const field = issue?.path.map(String).join(".");
  return field
    ? `${resource} data did not match the lead contract at ${field}: ${issue.message}`
    : `${resource} data did not match the lead contract.`;
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new LeadClientError(
      "The lead service could not be reached. Check your connection and retry.",
      "network",
    );
  }

  if (!response.ok) {
    throw new LeadClientError(
      `The lead service returned an error (${response.status}).`,
      "http",
    );
  }

  try {
    return await response.json();
  } catch {
    throw new LeadClientError(
      "The lead service returned unreadable data. Please retry.",
      "validation",
    );
  }
}

export async function fetchPrioritized(): Promise<PrioritizeResult> {
  if (useFixtures) return fixturePrioritizeResult;

  const payload = await requestJson("/api/prioritize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const parsed = PrioritizeResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new LeadClientError(
      validationMessage("Prioritization", parsed.error),
      "validation",
    );
  }
  return parsed.data;
}

export async function fetchLeads(): Promise<Lead[]> {
  if (useFixtures) return fixtureLeads;

  const payload = await requestJson("/api/leads");
  const parsed = LeadSchema.array().safeParse(payload);
  if (!parsed.success) {
    throw new LeadClientError(
      validationMessage("Lead list", parsed.error),
      "validation",
    );
  }
  return parsed.data;
}
