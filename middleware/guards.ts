/**
 * Middleware helpers for future auth gating.
 */

export const protectedPathPrefixes = [
  "/portal",
  "/orbit",
  "/dashboard",
  "/mail",
  "/compose",
  "/settings",
  "/contacts",
] as const;

export function isProtectedPath(pathname: string) {
  if (
    pathname === "/orbit/login" ||
    pathname === "/login" ||
    pathname === "/signin" ||
    pathname === "/"
  ) {
    return false;
  }
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
