import { z } from "zod";
import { getLeadRepository } from "../../../../../lib/data";
import { csvAdapter } from "../../../../../lib/intake/adapters/csvAdapter";
import { INTAKE_LIMITS } from "../../../../../lib/intake/config";
import { decodeRequestText, intakeError, readBoundedBytes } from "../../../../../lib/intake/http";
import { guardProtectedRoute } from "../../../../../lib/security/routeGuard";
import { ROUTE_SECURITY_CONFIG } from "../../../../../lib/security/config";

const CsvTextSchema = z.string().max(INTAKE_LIMITS.maxRequestBytes);

export async function POST(request: Request): Promise<Response> {
  const accessError = guardProtectedRoute(request, "intake");
  if (accessError) return accessError;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/csv") && !contentType.includes("multipart/form-data")) {
    return intakeError("UNSUPPORTED_MEDIA_TYPE", "Send text/csv or multipart/form-data.", 415);
  }
  let body: Uint8Array | null;
  try {
    body = await readBoundedBytes(request, Math.min(INTAKE_LIMITS.maxRequestBytes, ROUTE_SECURITY_CONFIG.maxIntakeRequestBytes));
  } catch {
    return intakeError("INVALID_REQUEST", "CSV payload could not be read.", 400);
  }
  if (!body) return intakeError("PAYLOAD_TOO_LARGE", "CSV exceeds the configured size limit.", 413);

  let csv: string;
  try {
    if (contentType.includes("multipart/form-data")) {
      const formBody = Uint8Array.from(body).buffer as ArrayBuffer;
      const formRequest = new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: formBody });
      const form = await formRequest.formData();
      const upload = form.get("file") ?? form.get("csv");
      if (typeof upload === "string") csv = upload;
      else if (upload instanceof File && upload.size <= INTAKE_LIMITS.maxRequestBytes) csv = await upload.text();
      else return intakeError("INVALID_REQUEST", "A CSV file is required.", 400);
    } else {
      const decoded = decodeRequestText(body);
      if (decoded === null) return intakeError("INVALID_REQUEST", "CSV must be valid UTF-8 text.", 400);
      csv = decoded;
    }
  } catch {
    return intakeError("INVALID_REQUEST", "CSV payload could not be read.", 400);
  }
  if (!CsvTextSchema.safeParse(csv).success || Buffer.byteLength(csv, "utf8") > INTAKE_LIMITS.maxRequestBytes) {
    return intakeError("PAYLOAD_TOO_LARGE", "CSV exceeds the configured size limit.", 413);
  }

  const parsed = await csvAdapter.parse(csv);
  try {
    await getLeadRepository().saveLeads(parsed.leads);
    return Response.json({ imported: parsed.leads.length, skipped: parsed.errors.length, errors: parsed.errors });
  } catch {
    return intakeError("INTAKE_FAILED", "CSV leads could not be saved.", 500);
  }
}