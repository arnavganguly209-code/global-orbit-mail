/**
 * GLOBAL ORBIT MAIL — Edge Middleware
 * Protects /orbit, /dashboard, and /webmail UI routes.
 * Admin API: requires session cookie (JSON 401). Full RBAC (DB role) is enforced in route handlers.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { SECURITY_HEADERS } from "@/lib/security/headers";
import { routes } from "@/config/routes";

function withSecurity(response: NextResponse, pathname: string) {
  response.headers.set(
    "x-go-surface",
    pathname.startsWith("/orbit") || pathname.startsWith("/api/admin") ? "admin" : "app",
  );
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function isPublicOrbitPath(pathname: string) {
  return pathname === routes.orbitLogin;
}

function isPublicWebmailPath(pathname: string) {
  return pathname === "/webmail/login" || pathname.startsWith("/webmail/login/");
}

function isPublicAdminApi(pathname: string) {
  return pathname === "/api/admin/auth/login";
}

function requiresUiSession(pathname: string) {
  if (pathname.startsWith("/orbit") && !pathname.startsWith("/api/")) {
    return !isPublicOrbitPath(pathname);
  }
  if (pathname === routes.dashboard || pathname.startsWith(`${routes.dashboard}/`)) {
    return true;
  }
  if (pathname === routes.webmail || pathname.startsWith(`${routes.webmail}/`)) {
    return !isPublicWebmailPath(pathname);
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const enforce = process.env.ADMIN_AUTH_ENFORCE !== "false";
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  // Admin API (except login): session cookie required. Role/permission checks run in handlers.
  if (pathname.startsWith("/api/admin") && !isPublicAdminApi(pathname)) {
    if (enforce && !sessionToken) {
      return withSecurity(
        NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }),
        pathname,
      );
    }
    return withSecurity(NextResponse.next(), pathname);
  }

  if (requiresUiSession(pathname)) {
    if (enforce && !sessionToken) {
      const loginUrl = request.nextUrl.clone();
      if (pathname.startsWith("/orbit")) {
        loginUrl.pathname = routes.orbitLogin;
      } else {
        loginUrl.pathname = routes.signin;
      }
      loginUrl.searchParams.set("next", pathname);
      return withSecurity(NextResponse.redirect(loginUrl), pathname);
    }
  }

  return withSecurity(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    "/orbit",
    "/orbit/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/webmail",
    "/webmail/:path*",
    "/portal/:path*",
    "/api/admin/:path*",
  ],
};
