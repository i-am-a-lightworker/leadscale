import {
  LeadRetrievalInputSchema,
  LeadSchema,
  type Lead,
} from "@/contracts/lead";

export interface LeadRepository {
  getById(id: string): Promise<Lead | null>;
}

export function createLeadRetrievalTool(repository: LeadRepository) {
  return async (rawInput: unknown): Promise<Lead | null> => {
    const { leadId } = LeadRetrievalInputSchema.parse(rawInput);
    return LeadSchema.nullable().parse(await repository.getById(leadId));
  };
}