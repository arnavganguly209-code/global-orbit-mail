/**
 * GLOBAL ORBIT MAIL — Edge Middleware
 * Prepared for auth gatekeeping, portal routing, and role redirects.
 * No auth enforcement in Phase 1.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/portal/:path*",
    "/admin/:path*",
    "/login",
    "/admin/login",
  ],
};
