import { NextResponse } from "next/server";
import { ErrorResponseSchema } from "@/contracts/lead";
import { z } from "zod";

export function validatedJson<T>(schema: z.ZodType<T>, data: unknown, status = 200) {
  return NextResponse.json(schema.parse(data), { status });
}

export function errorResponse(message: string, status: number) {
  return validatedJson(ErrorResponseSchema, { error: message }, status);
}