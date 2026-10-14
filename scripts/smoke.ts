import { randomUUID } from "node:crypto";
import { HealthApiResponseSchema, IntakeApiResponseSchema, LeadListResponseSchema, PrioritizeApiResponseSchema, StatusApiResponseSchema } from "../lib/types/api";
import { createSvixSignature } from "../lib/security/svixSignature";

type Check = { name: string; status: number; passed: boolean };

async function main(): Promise<void> {
  const target = process.argv.at(-1);
  if (!target || target.startsWith("--")) throw new Error("Usage: npm run smoke -- https://your-deployment.example");
  const baseUrl = new URL(target);
  if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") throw new Error("Smoke target must use HTTPS (localhost is allowed for local checks).");
  if (!process.env.RESEND_WEBHOOK_SECRET) throw new Error("RESEND_WEBHOOK_SECRET is required to sign the test email webhook.");
  if (!process.env.SMOKE_RESEND_EMAIL_ID) throw new Error("SMOKE_RESEND_EMAIL_ID must identify an accessible received email in the Resend account.");

  const headers = new Headers();
  if (process.env.ROUTE_SHARED_SECRET) headers.set("x-api-key", process.env.ROUTE_SHARED_SECRET);
  const checks: Check[] = [];
  async function checked(name: string, path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(new URL(path, baseUrl), init);
    checks.push({ name, status: response.status, passed: response.ok });
    return response;
  }

  const healthResponse = await checked("health", "/api/health");
  HealthApiResponseSchema.parse(await healthResponse.json());
  const statusResponse = await checked("status", "/api/status");
  const status = StatusApiResponseSchema.parse(await statusResponse.json());
  if (status.mode !== "mock") throw new Error("Set AGENT_MODE=mock before running the production smoke script.");

  const leadsResponse = await checked("leads", "/api/leads", { headers });
  const leads = LeadListResponseSchema.parse(await leadsResponse.json());
  const leadIds = leads.slice(0, 12).map(({ id }) => id);
  const prioritizeResponse = await checked("prioritize-mock", "/api/prioritize", {
    method: "POST",
    headers: new Headers([...headers.entries(), ["content-type", "application/json"]]),
    body: JSON.stringify(leadIds.length > 0 ? { leadIds } : {}),
  });
  PrioritizeApiResponseSchema.parse(await prioritizeResponse.json());

  const timestamp = String(Math.floor(Date.now() / 1000));
  const webhookId = `smoke-${randomUUID()}`;
  const eventBody = JSON.stringify({
    type: "email.received",
    created_at: new Date().toISOString(),
    data: {
      email_id: process.env.SMOKE_RESEND_EMAIL_ID,
      from: "smoke@example.test",
      subject: "Smoke verification",
    },
  });
  const signature = createSvixSignature(process.env.RESEND_WEBHOOK_SECRET, webhookId, timestamp, eventBody);
  const webhookHeaders = {
    "content-type": "application/json",
    "svix-id": webhookId,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  };
  const signedResponse = await checked("signed-email-webhook", "/api/intake/email", {
    method: "POST",
    headers: webhookHeaders,
    body: eventBody,
  });
  if (signedResponse.ok) IntakeApiResponseSchema.parse(await signedResponse.json());

  const invalidResponse = await checked("invalid-signature", "/api/intake/email", {
    method: "POST",
    headers: { ...webhookHeaders, "svix-id": `${webhookId}-invalid`, "svix-signature": "v1,invalid" },
    body: eventBody,
  });
  const invalidBody: unknown = await invalidResponse.json();
  const invalidPassed = invalidResponse.status === 401 && typeof invalidBody === "object" && invalidBody !== null;
  checks[checks.length - 1] = { name: "invalid-signature", status: invalidResponse.status, passed: invalidPassed };

  console.table(checks);
  if (checks.some(({ passed }) => !passed)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Smoke test failed.";
  console.error(JSON.stringify({ event: "smoke_failed", message }));
  process.exitCode = 1;
});