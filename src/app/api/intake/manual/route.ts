import { z } from "zod";
import { getLeadRepository } from "../../../../../lib/data";
import { manualAdapter } from "../../../../../lib/intake/adapters/manualAdapter";
import { INTAKE_LIMITS } from "../../../../../lib/intake/config";
import { decodeRequestText, intakeError, readBoundedBytes } from "../../../../../lib/intake/http";
import { guardProtectedRoute } from "../../../../../lib/security/routeGuard";
import { ROUTE_SECURITY_CONFIG } from "../../../../../lib/security/config";

const ManualPayloadSchema = z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]);

export async function POST(request: Request): Promise<Response> {
  const accessError = guardProtectedRoute(request, "intake");
  if (accessError) return accessError;
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return intakeError("UNSUPPORTED_MEDIA_TYPE", "Send application/json.", 415);
  }
  let body: unknown;
  try {
    const bytes = await readBoundedBytes(request, Math.min(INTAKE_LIMITS.maxRequestBytes, ROUTE_SECURITY_CONFIG.maxIntakeRequestBytes));
    if (!bytes) return intakeError("PAYLOAD_TOO_LARGE", "Manual payload exceeds the configured size limit.", 413);
    const text = decodeRequestText(bytes);
    if (text === null) return intakeError("INVALID_JSON", "Request body must be valid UTF-8 JSON.", 400);
    body = JSON.parse(text) as unknown;
  } catch {
    return intakeError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }
  const validated = ManualPayloadSchema.safeParse(body);
  if (!validated.success) return intakeError("INVALID_REQUEST", "Manual payload must be a lead object or an array of lead objects.", 400);

  const parsed = await manualAdapter.parse(validated.data);
  try {
    await getLeadRepository().saveLeads(parsed.leads);
    return Response.json({ imported: parsed.leads.length, skipped: parsed.errors.length, errors: parsed.errors });
  } catch {
    return intakeError("INTAKE_FAILED", "Manual leads could not be saved.", 500);
  }
}