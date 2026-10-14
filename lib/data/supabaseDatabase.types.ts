import type { Assessment } from "../types/lead";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type LeadRow = {
  id: string;
  source: string;
  received_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  property: Json;
  budget: Json;
  timeline: Json;
  message: string;
  engagement: Json;
  lead: Json;
  raw_source_data: Json;
  content_hash: string;
  dedupe_key: string;
  created_at: string;
  updated_at: string;
};

type PrioritizeRunRow = {
  run_id: string;
  mode: "mock" | "live";
  prompt_version: string;
  lead_count: number;
  scored_count: number;
  rejected_count: number;
  fallback_count: number;
  validation_failure_count: number;
  total_duration_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  created_at: string;
};

type AssessmentRow = {
  id: string;
  lead_id: string;
  assessment: Assessment;
  score: number;
  priority: string;
  confidence: string;
  source: "agent" | "fallback";
  prompt_version: string;
  adjustments: Json;
  flags: Json;
  input_hash: string;
  created_at: string;
};

type RejectedLeadRow = {
  id: string;
  lead_id: string | null;
  raw: Json;
  reasons: Json;
  created_at: string;
};

type IntakeEventRow = {
  id: string;
  provider_message_id: string;
  source: string;
  status: "pending" | "processed" | "rejected" | "failed";
  error: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: Omit<LeadRow, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string };
        Update: Partial<Omit<LeadRow, "id" | "created_at">>;
        Relationships: [];
      };
      assessments: {
        Row: AssessmentRow;
        Insert: Omit<AssessmentRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<AssessmentRow, "id" | "created_at" | "lead_id">>;
        Relationships: [];
      };
      rejected_leads: {
        Row: RejectedLeadRow;
        Insert: Omit<RejectedLeadRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<RejectedLeadRow, "id" | "created_at">>;
        Relationships: [];
      };
      intake_events: {
        Row: IntakeEventRow;
        Insert: Omit<IntakeEventRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<IntakeEventRow, "id" | "created_at">>;
        Relationships: [];
      };
      prioritize_runs: {
        Row: PrioritizeRunRow;
        Insert: Omit<PrioritizeRunRow, "created_at"> & { created_at?: string };
        Update: Partial<Omit<PrioritizeRunRow, "run_id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}