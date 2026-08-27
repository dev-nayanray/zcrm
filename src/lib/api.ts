import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Standard API envelope:
// Success: { success: true, data: {} }
// Error:   { success: false, error: { code, message, details? } }

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function err(code: string, message: string, status = 400, details?: unknown) {
  const error: ApiError = { code, message };
  if (details !== undefined) (error as { details?: unknown }).details = details;
  return NextResponse.json({ success: false, error }, { status });
}

export function unauthorized(message = "Authentication required") {
  return err("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return err("FORBIDDEN", message, 403);
}

export function notFound(message = "Resource not found") {
  return err("NOT_FOUND", message, 404);
}

export function validationError(zodError: ZodError) {
  return err(
    "VALIDATION_ERROR",
    "Invalid request",
    422,
    zodError.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

export function serverError(message = "Internal server error") {
  return err("INTERNAL_ERROR", message, 500);
}

export function badRequest(message = "Bad request") {
  return err("BAD_REQUEST", message, 400);
}

export function conflict(message = "Conflict", details?: unknown) {
  return err("CONFLICT", message, 409, details);
}

export function tooManyRequests(message = "Too many requests") {
  return err("RATE_LIMITED", message, 429);
}
