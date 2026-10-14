import { createHmac } from "node:crypto";

export function createSvixSignature(secret: string, messageId: string, timestamp: string, payload: string): string {
  const encodedSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(encodedSecret, "base64");
  if (key.length === 0) throw new Error("Webhook signing secret is invalid.");
  const signature = createHmac("sha256", key)
    .update(`${messageId}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${signature}`;
}