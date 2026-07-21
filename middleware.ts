/**
 * GLOBAL ORBIT MAIL — Edge Middleware (Phase 3A)
 * Protects /admin UI routes. Security headers on matched paths.
 * API auth is enforced in route handlers (JSON 401), not redirects.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { SECURITY_HEADERS } from "@/lib/security/headers";

function withSecurity(response: NextResponse, pathname: string) {
  response.headers.set(
    "x-go-surface",
    pathname.startsWith("/admin") ? "admin" : "app",
  );
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function isPublicAdminPath(pathname: string) {
  return pathname === "/admin/login";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/api/") &&
    !isPublicAdminPath(pathname)
  ) {
    const enforce = process.env.ADMIN_AUTH_ENFORCE !== "false";
    if (enforce && !request.cookies.get(SESSION_COOKIE)?.value) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("next", pathname);
      return withSecurity(NextResponse.redirect(loginUrl), pathname);
    }
  }

  return withSecurity(NextResponse.next(), pathname);
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/api/admin/:path*"],
};
