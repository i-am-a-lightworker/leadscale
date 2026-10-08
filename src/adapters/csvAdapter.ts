import type { Lead, LeadAdapter } from "@/contracts/lead";

export const csvAdapter: LeadAdapter = {
  parse(input: unknown): Lead[] {
    void input;
    throw new Error("TODO: implement CSV parsing and validate normalized rows with LeadSchema.");
  },
};