import type { Lead } from "../types/lead";
import type { StoredAssessment } from "./leadRepository";
import { leadAssessmentInputHash } from "./leadHash";

export function hasFreshAssessment(lead: Lead, cached: StoredAssessment | undefined, promptVersion: string): boolean {
  return cached !== undefined &&
    cached.promptVersion === promptVersion &&
    cached.inputHash === leadAssessmentInputHash(lead, promptVersion);
}