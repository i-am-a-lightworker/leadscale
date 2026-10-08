import { HealthResponseSchema } from "@/contracts/lead";
import { validatedJson } from "@/lib/validatedJson";

export function GET() {
  return validatedJson(HealthResponseSchema, { status: "ok" });
}