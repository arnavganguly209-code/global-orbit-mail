/**
 * Middleware helpers for future auth gating.
 */

export const protectedPathPrefixes = ["/portal", "/admin"] as const;

export function isProtectedPath(pathname: string) {
  if (pathname === "/admin/login" || pathname === "/login") return false;
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
