import { seedLeads } from "./seedLeads";
import { LeadSchema, type Lead } from "../types/lead";

export interface LeadRepository {
  getById(id: string): Promise<Lead | null>;
  list(): Promise<Lead[]>;
}

export class InMemoryLeadRepository implements LeadRepository {
  private readonly leads: Lead[];

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
}