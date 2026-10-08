import type { Lead, LeadAdapter } from "@/contracts/lead";

export const emailForwardAdapter: LeadAdapter = {
  parse(input: unknown): Lead[] {
    void input;
    throw new Error("TODO: confirm Resend inbound payload shape, then parse and normalize it.");
  },
};