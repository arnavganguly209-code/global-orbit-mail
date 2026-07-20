/**
 * Mailboxes feature module — Phase 3+.
 * Mail backend (Postfix/Dovecot/Rspamd) integrates here later.
 */
export const mailboxesFeature = {
  id: "mailboxes",
  status: "architecture-ready",
  mailEngine: "deferred",
} as const;
