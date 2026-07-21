import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authArchitecture, SESSION_COOKIE } from "@/lib/auth/permissions";

function isAdminLogin(pathname: string) {
  return pathname === "/admin/login";
}

function isAdminProtected(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function hasSessionCookie(request: NextRequest) {
  return Boolean(request.cookies.get(SESSION_COOKIE)?.value);
}

/**
 * Edge middleware — RBAC/session enforcement architecture.
 * Live auth is not connected. Set ADMIN_AUTH_ENFORCE=true to require session cookie.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminLogin(pathname)) {
    return NextResponse.next();
  }

  if (isAdminProtected(pathname) && authArchitecture.enforceAdminAuth) {
    if (!hasSessionCookie(request)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/portal") && authArchitecture.enforceAdminAuth) {
    if (!hasSessionCookie(request)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-go-surface", pathname.startsWith("/admin") ? "admin" : "app");
  return response;
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*", "/login", "/admin/login"],
};
