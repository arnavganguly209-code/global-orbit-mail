/**
 * Middleware helpers for future auth gating.
 * The active Next.js middleware entry is /middleware.ts at the project root.
 */

export const protectedPathPrefixes = ["/portal", "/admin"] as const;

export function isProtectedPath(pathname: string) {
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
