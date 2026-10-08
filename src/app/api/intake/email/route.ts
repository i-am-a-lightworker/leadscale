import { EmailIntakeRequestSchema } from "@/contracts/lead";
import { errorResponse } from "@/lib/validatedJson";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = EmailIntakeRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid email intake payload.", 400);

  return errorResponse("Email parsing is not implemented yet.", 501);
}