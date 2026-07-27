/**
 * GLOBAL ORBIT MAIL — Edge Middleware
 * Protects /orbit, /dashboard, and webmail UI routes (/mail, /compose, …).
 * On the webmail host, `/` is the login surface (rewrite to /login).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { SECURITY_HEADERS } from "@/lib/security/headers";
import { routes } from "@/config/routes";
import {
  isWebmailAppPath,
  isWebmailHostname,
  isWebmailPublicPath,
  webmailLegacyRedirects,
  webmailRoutes,
} from "@/config/webmail-routes";

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

function isPublicAdminApi(pathname: string) {
  return pathname === "/api/admin/auth/login";
}

function redirectPreservingQuery(request: NextRequest, pathname: string, status: 307 | 308 = 308) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url, status);
}

function legacyWebmailRedirect(pathname: string): string | null {
  for (const rule of webmailLegacyRedirects) {
    if (pathname === rule.source || pathname === `${rule.source}/`) {
      return rule.destination;
    }
  }
  // /webmail/mail/123 → /mail/123
  if (pathname.startsWith("/webmail/mail/")) {
    return pathname.replace(/^\/webmail/, "");
  }
  if (pathname.startsWith("/webmail/")) {
    const rest = pathname.slice("/webmail".length);
    if (rest === "/login" || rest.startsWith("/login/")) return webmailRoutes.home;
    return rest || webmailRoutes.home;
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const enforce = process.env.ADMIN_AUTH_ENFORCE !== "false";
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const webmailToken = request.cookies.get(WEBMAIL_SESSION_COOKIE)?.value;
  const host = request.headers.get("host");
  const onWebmailHost = isWebmailHostname(host);

  // Permanent redirects away from /webmail/* public UI
  const legacyDest = legacyWebmailRedirect(pathname);
  if (legacyDest !== null) {
    return withSecurity(redirectPreservingQuery(request, legacyDest, 308), pathname);
  }

  // Legacy Roundcube deep-links that somehow reach Next → login home
  const isRoundcubeLegacy =
    pathname === "/index.php" ||
    pathname.startsWith("/skins/") ||
    pathname.startsWith("/plugins/") ||
    pathname.startsWith("/program/") ||
    pathname.endsWith(".php") ||
    request.nextUrl.searchParams.has("_task");
  if (isRoundcubeLegacy) {
    return withSecurity(redirectPreservingQuery(request, webmailRoutes.home, 308), pathname);
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

  // Webmail host: `/` is login (or inbox when already signed in)
  if (onWebmailHost && (pathname === "/" || pathname === "")) {
    if (webmailToken) {
      return withSecurity(redirectPreservingQuery(request, webmailRoutes.mail, 307), pathname);
    }
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = webmailRoutes.login;
    return withSecurity(NextResponse.rewrite(rewriteUrl), pathname);
  }

  // Signed-in users hitting login → inbox
  if (
    (pathname === webmailRoutes.login || pathname.startsWith(`${webmailRoutes.login}/`)) &&
    webmailToken
  ) {
    return withSecurity(redirectPreservingQuery(request, webmailRoutes.mail, 307), pathname);
  }

  // Protect webmail app surfaces
  if (isWebmailAppPath(pathname)) {
    if (enforce && !webmailToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = onWebmailHost ? webmailRoutes.home : webmailRoutes.login;
      loginUrl.searchParams.set("next", pathname);
      return withSecurity(NextResponse.redirect(loginUrl), pathname);
    }
    return withSecurity(NextResponse.next(), pathname);
  }

  // Login page itself is public
  if (isWebmailPublicPath(pathname)) {
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
    "/login",
    "/login/:path*",
    "/mail",
    "/mail/:path*",
    "/compose",
    "/compose/:path*",
    "/settings",
    "/settings/:path*",
    "/contacts",
    "/contacts/:path*",
    "/webmail",
    "/webmail/:path*",
    "/orbit",
    "/orbit/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/portal/:path*",
    "/api/admin/:path*",
    "/index.php",
    "/skins/:path*",
    "/plugins/:path*",
    "/program/:path*",
  ],
};
