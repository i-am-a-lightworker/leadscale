import { INTAKE_LIMITS } from "./config";

export function intakeError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function contentLengthTooLarge(request: Request): boolean {
  const contentLength = Number(request.headers.get("content-length"));
  return Number.isFinite(contentLength) && contentLength > INTAKE_LIMITS.maxRequestBytes;
}

export async function readBoundedBytes(request: Request): Promise<Uint8Array | null> {
  if (contentLengthTooLarge(request)) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > INTAKE_LIMITS.maxRequestBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function decodeRequestText(body: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  }
}