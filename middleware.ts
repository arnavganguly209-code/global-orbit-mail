/**
 * GLOBAL ORBIT MAIL — Edge Middleware (Phase 2B)
 * Protects /admin UI routes. API routes enforce auth in handlers.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/permissions";

function isPublicAdminPath(pathname: string) {
  return (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth/login")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !isPublicAdminPath(pathname)) {
    const enforce = process.env.ADMIN_AUTH_ENFORCE !== "false";
    if (enforce && !request.cookies.get(SESSION_COOKIE)?.value) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();
  response.headers.set(
    "x-go-surface",
    pathname.startsWith("/admin") ? "admin" : "app",
  );
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
