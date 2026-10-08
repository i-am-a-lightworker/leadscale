import { LeadSchema, type Lead, type LeadAdapter } from "@/contracts/lead";

export const manualAdapter: LeadAdapter = {
  parse(input: unknown): Lead[] {
    const records = Array.isArray(input) ? input : [input];
    return records.map((record) => LeadSchema.parse(record));
  },
};