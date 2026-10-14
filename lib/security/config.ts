export const ROUTE_SECURITY_CONFIG = {
  rateWindowMs: 60_000,
  maxIntakeRequestsPerWindow: 20,
  maxPrioritizeRequestsPerWindow: 30,
  maxPrioritizeLeads: 12,
  maxIntakeRequestBytes: 2_000_000,
  maxPrioritizeRequestBytes: 64_000,
  maxAgentTimeoutMs: 15_000,
  maxAgentConcurrency: 3,
  maxLeadMessageChars: 4_000,
} as const;

// TODO(verify): This process-local limiter is not shared across Vercel Function instances.