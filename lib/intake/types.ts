import type { Lead } from "../types/lead";

export type ParseError = { row?: number; message: string };

export type ParseResult = {
  leads: Lead[];
  errors: ParseError[];
};

export interface IntakeAdapter {
  readonly id: string;
  canHandle(input: unknown): boolean;
  parse(input: unknown): Promise<ParseResult>;
}