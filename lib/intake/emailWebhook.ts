import { z } from "zod";
import type { LeadRepository } from "../data/leadRepository";
import { emailForwardAdapter } from "./adapters/emailForwardAdapter";
import { decodeRequestText, intakeError, readBoundedBytes } from "./http";

const ResendReceivedEventSchema = z.object({
  type: z.literal("email.received"),
  created_at: z.string().datetime().optional(),
  data: z.object({
    email_id: z.string().trim().min(1),
    from: z.string().trim().min(1),
    subject: z.string().optional(),
    created_at: z.string().datetime().optional(),
  }).passthrough(),
}).passthrough();

type ResendReceivedEmail = {
  id: string;
  from: string;
  subject: string;
  text: string | null;
  html: string | null;
  created_at: string;
};

export type EmailWebhookDependencies = {
  verify: (payload: string, headers: { id: string; timestamp: string; signature: string }) => unknown;
  getReceivedEmail: (emailId: string) => Promise<ResendReceivedEmail>;
  repository: LeadRepository;
  webhookSecretConfigured?: boolean;
};

export async function handleEmailWebhook(request: Request, dependencies: EmailWebhookDependencies): Promise<Response> {
  const headerValues = {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  };
  if (!headerValues.id || !headerValues.timestamp || !headerValues.signature) {
    return intakeError("UNSIGNED_WEBHOOK", "A valid signed email webhook is required.", 401);
  }
  if (dependencies.webhookSecretConfigured === false) {
    return intakeError("WEBHOOK_NOT_CONFIGURED", "Email webhook verification is not configured.", 503);
  }
  let payload: string;
  try {
    const body = await readBoundedBytes(request);
    if (!body) return intakeError("PAYLOAD_TOO_LARGE", "Webhook payload exceeds the configured size limit.", 413);
    const decoded = decodeRequestText(body);
    if (decoded === null) return intakeError("INVALID_WEBHOOK", "Webhook payload must be valid UTF-8.", 400);
    payload = decoded;
  } catch {
    return intakeError("INVALID_REQUEST", "Webhook payload could not be read.", 400);
  }

  let verified: unknown;
  try {
    verified = dependencies.verify(payload, headerValues);
  } catch {
    return intakeError("INVALID_SIGNATURE", "Webhook signature is invalid.", 401);
  }
  const event = ResendReceivedEventSchema.safeParse(verified);
  if (!event.success) return intakeError("INVALID_WEBHOOK", "Webhook event payload is invalid.", 400);

  const emailId = event.data.data.email_id;
  try {
    const claimed = await dependencies.repository.claimIntakeEvent(emailId, "email-forward");
    if (!claimed) return Response.json({ imported: 0, skipped: 1, errors: [] });

    const receivedEmail = await dependencies.getReceivedEmail(emailId);
    const parsed = await emailForwardAdapter.parse({
      providerEmailId: emailId,
      from: receivedEmail.from || event.data.data.from,
      subject: receivedEmail.subject || event.data.data.subject || "",
      text: receivedEmail.text ?? "",
      html: receivedEmail.html ?? "",
      receivedAt: receivedEmail.created_at || event.data.data.created_at || event.data.created_at || new Date().toISOString(),
      rawSourceData: { provider: "resend", webhookEvent: event.data, receivedEmail },
    });
    await dependencies.repository.saveLeads(parsed.leads);
    await dependencies.repository.finishIntakeEvent(emailId, parsed.leads.length > 0 ? "processed" : "rejected");
    return Response.json({ imported: parsed.leads.length, skipped: parsed.errors.length, errors: parsed.errors });
  } catch {
    await dependencies.repository.finishIntakeEvent(emailId, "failed", "Email intake processing failed.").catch(() => undefined);
    return intakeError("EMAIL_INTAKE_FAILED", "Email could not be imported.", 500);
  }
}