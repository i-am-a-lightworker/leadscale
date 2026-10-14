import { getLeadRepository } from "../../../../../lib/data";
import { handleEmailWebhook } from "../../../../../lib/intake/emailWebhook";
import { getResendReceivedEmail, verifyResendWebhook } from "../../../../../lib/intake/resend";

export async function POST(request: Request): Promise<Response> {
  return handleEmailWebhook(request, {
    verify: verifyResendWebhook,
    getReceivedEmail: getResendReceivedEmail,
    repository: getLeadRepository(),
    webhookSecretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  });
}