/**
 * Production mail hostname — always from env, never hardcoded .com.
 * Default matches current production: mail.globalorbitmail.cloud
 */

const DEFAULT_MAIL_HOSTNAME = "mail.globalorbitmail.cloud";
const DEFAULT_WEBMAIL_HOSTNAME = "webmail.globalorbitmail.cloud";
const DEFAULT_AUTOCONFIG_HOSTNAME = "webmail.globalorbitmail.cloud";

function cleanHost(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

/** Shared mail MX / SPF / SRV target hostname. */
export function getConfiguredMailHostname(): string {
  const fromEnv = process.env.MAIL_HOSTNAME?.trim();
  return cleanHost(fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MAIL_HOSTNAME);
}

export function getConfiguredWebmailHostname(): string {
  const fromEnv = process.env.WEBMAIL_HOSTNAME?.trim();
  return cleanHost(fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_WEBMAIL_HOSTNAME);
}

export function getConfiguredAutoconfigHostname(): string {
  const fromEnv = process.env.AUTOCONFIG_HOSTNAME?.trim();
  if (fromEnv && fromEnv.length > 0) return cleanHost(fromEnv);
  return getConfiguredWebmailHostname() || cleanHost(DEFAULT_AUTOCONFIG_HOSTNAME);
}

export const MAIL_HOSTNAME_DEFAULT = DEFAULT_MAIL_HOSTNAME;
