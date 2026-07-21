/**
 * Sanitize API/domain errors — never leak Prisma / stack traces to clients.
 */

import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export function toFriendlyDomainError(error: unknown): {
  message: string;
  status: number;
  code?: "EXISTS" | "INVALID" | "FORBIDDEN" | "UNAUTHORIZED" | "ERROR";
} {
  if (error instanceof ZodError) {
    const first = error.issues[0]?.message ?? "Invalid domain name.";
    return { message: first.includes("domain") ? first : "Invalid domain name.", status: 400, code: "INVALID" };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        message: "This domain already exists in your account.",
        status: 409,
        code: "EXISTS",
      };
    }
    return { message: "Unable to save domain. Please try again.", status: 400, code: "ERROR" };
  }

  const raw = error instanceof Error ? error.message : "Unable to save domain. Please try again.";
  const lower = raw.toLowerCase();

  if (lower.includes("unique constraint") || lower.includes("already exists")) {
    return {
      message: "This domain already exists in your account.",
      status: 409,
      code: "EXISTS",
    };
  }
  if (lower.includes("unauthorized")) {
    return { message: "Unauthorized", status: 401, code: "UNAUTHORIZED" };
  }
  if (lower.includes("forbidden") || lower.includes("csrf")) {
    return { message: raw.startsWith("Forbidden") || raw === "Invalid CSRF token" ? raw : "Forbidden", status: 403, code: "FORBIDDEN" };
  }
  if (
    lower.includes("prisma") ||
    lower.includes("invalid `prisma") ||
    lower.includes("invocation") ||
    lower.includes("database") ||
    lower.includes("econnrefused") ||
    lower.includes("stack")
  ) {
    return { message: "Unable to save domain. Please try again.", status: 400, code: "ERROR" };
  }
  if (lower.includes("invalid domain") || lower.includes("root domain")) {
    return { message: "Invalid domain name.", status: 400, code: "INVALID" };
  }

  return { message: raw, status: 400, code: "ERROR" };
}
