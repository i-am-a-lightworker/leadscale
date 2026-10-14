import { createHash } from "node:crypto";
import type { Lead } from "../types/lead";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function leadContentHash(lead: Lead): string {
  return hash(lead);
}

export function leadAssessmentInputHash(lead: Lead, promptVersion: string): string {
  return hash({ lead, promptVersion });
}

export function leadDedupeKey(lead: Lead): string {
  if (lead.email) return `email:${lead.email.trim().toLowerCase()}`;
  return `phone:${lead.phone?.replace(/\D/g, "") ?? lead.id}`;
}