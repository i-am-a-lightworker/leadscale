import { HealthApiResponseSchema } from "../../../../lib/types/api";

export function GET() {
  return Response.json(HealthApiResponseSchema.parse({ status: "ok" }));
}