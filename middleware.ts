/**
 * GLOBAL ORBIT MAIL — Edge Middleware
 * Protects /orbit, /dashboard, and /webmail UI routes.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { SECURITY_HEADERS } from "@/lib/security/headers";
import { routes } from "@/config/routes";

/** Encrypted mailbox session cookie (IMAP credentials). */
const WEBMAIL_SESSION_COOKIE = "go_webmail_session";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const enforce = process.env.ADMIN_AUTH_ENFORCE !== "false";
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const webmailToken = request.cookies.get(WEBMAIL_SESSION_COOKIE)?.value;

  // Legacy Roundcube deep-links that somehow reach Next → Orbit login
  const isRoundcubeLegacy =
    pathname === "/index.php" ||
    pathname.startsWith("/skins/") ||
    pathname.startsWith("/plugins/") ||
    pathname.startsWith("/program/") ||
    pathname.endsWith(".php") ||
    request.nextUrl.searchParams.has("_task");
  if (isRoundcubeLegacy) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/webmail/login";
    loginUrl.search = "";
    return withSecurity(NextResponse.redirect(loginUrl), pathname);
  }

  if (pathname.startsWith("/api/admin") && !isPublicAdminApi(pathname)) {
    if (enforce && !sessionToken) {
      return withSecurity(
        NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }),
        pathname,
      );
    }
    return withSecurity(NextResponse.next(), pathname);
  }

  // Webmail UI — mailbox session only
  if (pathname === routes.webmail || pathname.startsWith(`${routes.webmail}/`)) {
    if (!isPublicWebmailPath(pathname) && enforce && !webmailToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/webmail/login";
      loginUrl.searchParams.set("next", pathname);
      return withSecurity(NextResponse.redirect(loginUrl), pathname);
    }
    return withSecurity(NextResponse.next(), pathname);
  }

  // Admin / customer dashboard UI
  if (pathname.startsWith("/orbit") && !pathname.startsWith("/api/")) {
    if (!isPublicOrbitPath(pathname) && enforce && !sessionToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = routes.orbitLogin;
      loginUrl.searchParams.set("next", pathname);
      return withSecurity(NextResponse.redirect(loginUrl), pathname);
    }
  }

  if (pathname === routes.dashboard || pathname.startsWith(`${routes.dashboard}/`)) {
    if (enforce && !sessionToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = routes.signin;
      loginUrl.searchParams.set("next", pathname);
      return withSecurity(NextResponse.redirect(loginUrl), pathname);
    }
  }

  return withSecurity(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    "/",
    "/orbit",
    "/orbit/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/webmail",
    "/webmail/:path*",
    "/portal/:path*",
    "/api/admin/:path*",
    "/index.php",
    "/skins/:path*",
    "/plugins/:path*",
    "/program/:path*",
  ],
};
