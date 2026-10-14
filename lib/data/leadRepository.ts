import { seedLeads } from "./seedLeads";
import { AssessmentSchema, LeadSchema, type Assessment, type Lead } from "../types/lead";
import { leadDedupeKey } from "./leadHash";

export type AssessmentSource = "agent" | "fallback";

export type AssessmentToSave = {
  leadId: string;
  assessment: Assessment;
  source: AssessmentSource;
  promptVersion: string;
  adjustments: string[];
  flags: string[];
  inputHash: string;
};

export type StoredAssessment = AssessmentToSave & { createdAt: string };

export type RejectedLeadToSave = {
  leadId: string;
  raw: Record<string, unknown>;
  reasons: string[];
};

export type IntakeEventStatus = "pending" | "processed" | "rejected" | "failed";

export interface LeadRepository {
  getById(id: string): Promise<Lead | null>;
  list(): Promise<Lead[]>;
  saveLeads(leads: readonly Lead[]): Promise<void>;
  saveAssessments(assessments: readonly AssessmentToSave[]): Promise<void>;
  saveRejected(leads: readonly RejectedLeadToSave[]): Promise<void>;
  getLatestAssessments(leadIds: readonly string[]): Promise<Record<string, StoredAssessment>>;
  claimIntakeEvent(providerMessageId: string, source: string): Promise<boolean>;
  finishIntakeEvent(providerMessageId: string, status: IntakeEventStatus, error?: string): Promise<void>;
}

export class InMemoryLeadRepository implements LeadRepository {
  private readonly leads: Lead[];
  private readonly assessments = new Map<string, StoredAssessment>();
  private readonly intakeEvents = new Map<string, { source: string; status: IntakeEventStatus; error?: string }>();
  private readonly rejected: RejectedLeadToSave[] = [];

  constructor(leads: readonly unknown[] = seedLeads) {
    this.leads = leads.map((lead) => LeadSchema.parse(lead));
  }

  async getById(id: string): Promise<Lead | null> {
    const lead = this.leads.find((candidate) => candidate.id === id);
    return lead ? LeadSchema.parse(lead) : null;
  }

  async list(): Promise<Lead[]> {
    return this.leads.map((lead) => LeadSchema.parse(lead));
  }

  async saveLeads(leads: readonly Lead[]): Promise<void> {
    for (const candidate of leads) {
      const lead = LeadSchema.parse(candidate);
      const key = leadDedupeKey(lead);
      const existingIndex = this.leads.findIndex((saved) => leadDedupeKey(saved) === key);
      if (existingIndex < 0) {
        this.leads.push(lead);
        continue;
      }
      const existing = this.leads[existingIndex]!;
      if (Date.parse(lead.receivedAt) > Date.parse(existing.receivedAt)) {
        this.leads[existingIndex] = LeadSchema.parse({ ...lead, id: existing.id });
      }
    }
  }

  async saveAssessments(assessments: readonly AssessmentToSave[]): Promise<void> {
    for (const item of assessments) {
      const parsed = AssessmentSchema.parse(item.assessment);
      this.assessments.set(item.leadId, { ...item, assessment: parsed, createdAt: new Date().toISOString() });
    }
  }

  async saveRejected(leads: readonly RejectedLeadToSave[]): Promise<void> {
    this.rejected.push(...leads.map((item) => ({ ...item, reasons: [...item.reasons] })));
  }

  async getLatestAssessments(leadIds: readonly string[]): Promise<Record<string, StoredAssessment>> {
    const result: Record<string, StoredAssessment> = {};
    for (const leadId of leadIds) {
      const assessment = this.assessments.get(leadId);
      if (assessment) result[leadId] = { ...assessment, assessment: AssessmentSchema.parse(assessment.assessment) };
    }
    return result;
  }

  async claimIntakeEvent(providerMessageId: string, source: string): Promise<boolean> {
    const existing = this.intakeEvents.get(providerMessageId);
    if (existing && existing.status !== "failed") return false;
    this.intakeEvents.set(providerMessageId, { source, status: "pending" });
    return true;
  }

  async finishIntakeEvent(providerMessageId: string, status: IntakeEventStatus, error?: string): Promise<void> {
    const event = this.intakeEvents.get(providerMessageId);
    if (!event) return;
    this.intakeEvents.set(providerMessageId, { ...event, status, ...(error ? { error } : {}) });
  }
}