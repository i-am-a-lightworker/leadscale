export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type LeadRow = {
  id: string;
  source: string;
  received_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  property: Json;
  budget: Json;
  timeline: string;
  message: string;
  engagement: Json;
  raw_source_data: Json;
  created_at: string;
};

type LeadScoreRow = {
  id: string;
  lead_id: string;
  score: number;
  priority: string;
  reasons: Json;
  next_action: string;
  missing_information: Json;
  confidence: number;
  generated_at: string;
};

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: Omit<LeadRow, "created_at"> & { created_at?: string };
        Update: Partial<Omit<LeadRow, "id" | "created_at">>;
        Relationships: [];
      };
      lead_scores: {
        Row: LeadScoreRow;
        Insert: Omit<LeadScoreRow, "id" | "generated_at"> & { id?: string; generated_at?: string };
        Update: Partial<Omit<LeadScoreRow, "id" | "lead_id" | "generated_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}