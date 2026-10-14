import { afterEach, describe, expect, it } from "vitest";
import { GET as healthGet } from "../../src/app/api/health/route";
import { GET as statusGet } from "../../src/app/api/status/route";
import { GET as leadsGet } from "../../src/app/api/leads/route";
import { GET as leadDetailGet } from "../../src/app/api/leads/[id]/route";
import { POST as prioritizePost } from "../../src/app/api/prioritize/route";
import { POST as csvPost } from "../../src/app/api/intake/csv/route";
import { POST as manualPost } from "../../src/app/api/intake/manual/route";
import { POST as emailPost } from "../../src/app/api/intake/email/route";
import { seedLeads as legacySeedLeads } from "../../src/data/seedLeads";
import {
  ApiErrorResponseSchema,
  HealthApiResponseSchema,
  IntakeApiResponseSchema,
  LeadListResponseSchema,
  LegacyLeadDetailResponseSchema,
  LegacyMessageErrorResponseSchema,
  PrioritizeApiResponseSchema,
  StatusApiResponseSchema,
} from "../../lib/types/api";

const originalEnvironment = {
  backend: process.env.DATA_BACKEND,
  mode: process.env.AGENT_MODE,
  routeSecret: process.env.ROUTE_SHARED_SECRET,
};

afterEach(() => {
  if (originalEnvironment.backend === undefined) delete process.env.DATA_BACKEND;
  else process.env.DATA_BACKEND = originalEnvironment.backend;
  if (originalEnvironment.mode === undefined) delete process.env.AGENT_MODE;
  else process.env.AGENT_MODE = originalEnvironment.mode;
  if (originalEnvironment.routeSecret === undefined) delete process.env.ROUTE_SHARED_SECRET;
  else process.env.ROUTE_SHARED_SECRET = originalEnvironment.routeSecret;
});

function request(url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, init);
}

describe("public and lead API contracts", () => {
  it("validates health, status, and lead-list responses", async () => {
    process.env.DATA_BACKEND = "memory";
    process.env.AGENT_MODE = "mock";
    const health = await healthGet();
    const status = await statusGet();
    const leads = await leadsGet(request("/api/leads"));
    expect(HealthApiResponseSchema.safeParse(await health.json()).success).toBe(true);
    expect(StatusApiResponseSchema.safeParse(await status.json()).success).toBe(true);
    expect(LeadListResponseSchema.safeParse(await leads.json()).success).toBe(true);
  });

  it("validates the existing legacy lead-detail payload without changing its shape", async () => {
    const id = legacySeedLeads[0]?.id;
    if (!id) throw new Error("Legacy detail fixture is missing.");
    const response = await leadDetailGet(request(`/api/leads/${id}`), { params: Promise.resolve({ id }) });
    expect(LegacyLeadDetailResponseSchema.safeParse(await response.json()).success).toBe(true);
    const missing = await leadDetailGet(request("/api/leads/not-a-uuid"), { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(LegacyMessageErrorResponseSchema.safeParse(await missing.json()).success).toBe(true);
  });

  it("validates successful and error prioritize responses", async () => {
    process.env.DATA_BACKEND = "memory";
    process.env.AGENT_MODE = "mock";
    const success = await prioritizePost(request("/api/prioritize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadIds: ["strong"] }),
    }));
    const failure = await prioritizePost(request("/api/prioritize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));
    expect(PrioritizeApiResponseSchema.safeParse(await success.json()).success).toBe(true);
    expect(ApiErrorResponseSchema.safeParse(await failure.json()).success).toBe(true);
  });

  it("validates manual, CSV, and unsigned email intake responses", async () => {
    process.env.DATA_BACKEND = "memory";
    const manual = await manualPost(request("/api/intake/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Contract Buyer", email: "contract@example.test", message: "Please contact me." }),
    }));
    const csv = await csvPost(request("/api/intake/csv", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: "Name,Email,Message\nCSV Buyer,csv-contract@example.test,Please call.",
    }));
    const email = await emailPost(request("/api/intake/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "email.received", data: { email_id: "unsigned-contract-test", from: "test@example.test" } }),
    }));
    expect(IntakeApiResponseSchema.safeParse(await manual.json()).success).toBe(true);
    expect(IntakeApiResponseSchema.safeParse(await csv.json()).success).toBe(true);
    expect(ApiErrorResponseSchema.safeParse(await email.json()).success).toBe(true);
  });

  it("provides mock-only empty, error, slow, and fallback UI states", async () => {
    process.env.DATA_BACKEND = "memory";
    process.env.AGENT_MODE = "mock";
    const empty = await leadsGet(request("/api/leads?simulate=empty"));
    const failed = await leadsGet(request("/api/leads?simulate=error"));
    const slowStart = Date.now();
    const slow = await leadsGet(request("/api/leads?simulate=slow"));
    const fallback = await prioritizePost(request("/api/prioritize?simulate=fallback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadIds: ["strong"] }),
    }));
    expect(LeadListResponseSchema.safeParse(await empty.json()).success).toBe(true);
    expect(ApiErrorResponseSchema.safeParse(await failed.json()).success).toBe(true);
    expect(slow.ok).toBe(true);
    expect(Date.now() - slowStart).toBeGreaterThanOrEqual(1_000);
    const result = PrioritizeApiResponseSchema.parse(await fallback.json());
    expect(result.meta[0]?.source).toBe("fallback");
  });
});