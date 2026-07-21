/**
 * CSRF double-submit cookie token.
 */

import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
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

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a.trim());
  const right = Buffer.from(b.trim());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Enforce double-submit CSRF on mutating admin/customer requests. */
export async function assertCsrf(request: Request) {
  const header = (
    request.headers.get("x-csrf-token") ??
    request.headers.get("x-xsrf-token") ??
    ""
  ).trim();
  const jar = await cookies();
  const cookie = (jar.get(CSRF_COOKIE)?.value ?? "").trim();
  if (!header || !cookie || !safeEqual(header, cookie)) {
    throw Object.assign(new Error("Invalid CSRF token"), { status: 403 });
  }
}

/** Ensure a readable CSRF cookie exists; returns the token value. */
export async function ensureCsrfCookie(maxAgeSeconds: number): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value?.trim();
  if (existing) return existing;
  const token = createCsrfToken();
  jar.set(CSRF_COOKIE, token, csrfCookieOptions(maxAgeSeconds));
  return token;
}

export { CSRF_COOKIE };
