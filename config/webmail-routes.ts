/**
 * GLOBAL ORBIT MAIL — Public webmail UI paths (no /webmail prefix).
 * API remains under /api/webmail/* (internal).
 */

export const webmailRoutes = {
  home: "/",
  login: "/login",
  mail: "/mail",
  compose: "/compose",
  settings: "/settings",
  profile: "/profile",
  contacts: "/contacts",
  message: (id: string | number) => `/mail/${id}`,
} as const;

/** Legacy public paths that must 308 to the new structure. */
export const webmailLegacyRedirects: Array<{ source: string; destination: string }> = [
  { source: "/webmail", destination: "/" },
  { source: "/webmail/login", destination: "/" },
  { source: "/webmail/mail", destination: "/mail" },
  { source: "/webmail/compose", destination: "/compose" },
  { source: "/webmail/settings", destination: "/settings" },
  { source: "/webmail/contacts", destination: "/contacts" },
];

export function isWebmailHostname(host: string | null | undefined) {
  if (!host) return false;
  const hostname = host.split(":")[0].toLowerCase();
  const configured = (process.env.WEBMAIL_HOSTNAME || "webmail.globalorbitmail.cloud").toLowerCase();
  if (hostname === configured || hostname.startsWith("webmail.")) return true;
  // Opt-in for local Next ↔ webmail surface testing
  if (process.env.WEBMAIL_FORCE_HOST === "1") {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }
  return false;
}

export function isWebmailPublicPath(pathname: string) {
  return (
    pathname === webmailRoutes.home ||
    pathname === webmailRoutes.login ||
    pathname === `${webmailRoutes.login}/`
  );
}

export function isWebmailAppPath(pathname: string) {
  return (
    pathname === webmailRoutes.mail ||
    pathname.startsWith(`${webmailRoutes.mail}/`) ||
    pathname === webmailRoutes.compose ||
    pathname.startsWith(`${webmailRoutes.compose}/`) ||
    pathname === webmailRoutes.settings ||
    pathname.startsWith(`${webmailRoutes.settings}/`) ||
    pathname === webmailRoutes.profile ||
    pathname.startsWith(`${webmailRoutes.profile}/`) ||
    pathname === webmailRoutes.contacts ||
    pathname.startsWith(`${webmailRoutes.contacts}/`)
  );
}
