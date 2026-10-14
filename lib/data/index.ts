import { InMemoryLeadRepository, type LeadRepository } from "./leadRepository";
import { SupabaseLeadRepository } from "./supabaseLeadRepository";

let memoryRepository: InMemoryLeadRepository | undefined;
let supabaseRepository: SupabaseLeadRepository | undefined;

export function getLeadRepository(backend = process.env.DATA_BACKEND ?? "memory"): LeadRepository {
  if (backend === "memory") {
    memoryRepository ??= new InMemoryLeadRepository();
    return memoryRepository;
  }
  if (backend === "supabase") {
    supabaseRepository ??= new SupabaseLeadRepository();
    return supabaseRepository;
  }
  throw new Error("DATA_BACKEND must be memory or supabase.");
}