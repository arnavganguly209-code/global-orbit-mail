/**
 * Middleware helpers for future auth gating.
 */

export const protectedPathPrefixes = ["/portal", "/orbit", "/dashboard", "/webmail"] as const;

export function isProtectedPath(pathname: string) {
  if (pathname === "/orbit/login" || pathname === "/login" || pathname === "/signin") {
    return false;
  }
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
