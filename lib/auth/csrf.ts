/**
 * CSRF readiness — double-submit cookie token (Phase 3A).
 * SameSite session cookies mitigate CSRF; this token is ready for mutating forms.
 */

import { randomBytes } from "crypto";
import { CSRF_COOKIE } from "@/lib/auth/constants";

export function createCsrfToken() {
  return randomBytes(32).toString("hex");
}

export function csrfCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export { CSRF_COOKIE };
