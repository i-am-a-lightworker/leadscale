import { Resend, type GetReceivingEmailResponseSuccess } from "resend";

function resendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

export function verifyResendWebhook(payload: string, headers: { id: string; timestamp: string; signature: string }): unknown {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Resend webhook verification is not configured.");
  return resendClient().webhooks.verify({ payload, headers, webhookSecret });
}

export async function getResendReceivedEmail(emailId: string): Promise<GetReceivingEmailResponseSuccess> {
  if (!process.env.RESEND_API_KEY) throw new Error("Resend inbound retrieval is not configured.");
  const response = await resendClient().emails.receiving.get(emailId);
  if (response.error || !response.data) throw new Error("Received email could not be retrieved.");
  return response.data;
}