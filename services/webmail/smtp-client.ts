/**
 * GLOBAL ORBIT MAIL — SMTP send (AUTH PLAIN / SMTPS 465)
 * Matches production Roundcube transport: ssl://127.0.0.1:465 + PLAIN.
 */

import nodemailer from "nodemailer";
import type { WebmailCredentials } from "./session-store";

export type SendMailInput = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
};

export function createSmtpTransport(creds: WebmailCredentials) {
  const host = process.env.WEBMAIL_SMTP_HOST || "127.0.0.1";
  const port = Number(process.env.WEBMAIL_SMTP_PORT || "465");
  const secure = process.env.WEBMAIL_SMTP_SECURE !== "false" && port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: creds.email,
      pass: creds.password,
      method: "PLAIN",
    },
    tls: { rejectUnauthorized: process.env.WEBMAIL_SMTP_TLS_REJECT === "true" },
  });
}

export async function sendMail(creds: WebmailCredentials, input: SendMailInput) {
  const transport = createSmtpTransport(creds);
  const info = await transport.sendMail({
    from: creds.email,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    text: input.text,
    html: input.html,
    inReplyTo: input.inReplyTo,
    references: input.references,
    attachments: input.attachments,
  });
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}
