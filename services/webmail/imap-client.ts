/**
 * GLOBAL ORBIT MAIL — IMAP client (imapflow)
 * Default: localhost Dovecot on VPS. Override with WEBMAIL_IMAP_*.
 */

import { ImapFlow } from "imapflow";
import type { WebmailCredentials } from "./session-store";

export function imapConfig(creds: WebmailCredentials) {
  const host = process.env.WEBMAIL_IMAP_HOST || "127.0.0.1";
  const port = Number(process.env.WEBMAIL_IMAP_PORT || "143");
  const secure =
    process.env.WEBMAIL_IMAP_SECURE === "true" ||
    port === 993 ||
    process.env.WEBMAIL_IMAP_TLS === "true";

  return {
    host,
    port,
    secure,
    auth: { user: creds.email, pass: creds.password },
    logger: false as const,
    tls: { rejectUnauthorized: process.env.WEBMAIL_IMAP_TLS_REJECT === "true" },
  };
}

export async function withImap<T>(
  creds: WebmailCredentials,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow(imapConfig(creds));
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

/** Verify mailbox credentials by connecting to IMAP. */
export async function verifyMailboxLogin(email: string, password: string): Promise<boolean> {
  const client = new ImapFlow(
    imapConfig({ email: email.toLowerCase().trim(), password }),
  );
  try {
    await client.connect();
    await client.logout();
    return true;
  } catch {
    try {
      client.close();
    } catch {
      /* ignore */
    }
    return false;
  }
}

export function normalizeFolderPath(folder?: string | null) {
  const raw = (folder || "INBOX").trim();
  if (!raw) return "INBOX";
  return raw;
}
