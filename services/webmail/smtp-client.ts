/**
 * GLOBAL ORBIT MAIL — SMTP send (AUTH PLAIN / SMTPS 465)
 * Builds full MIME (cc/attachments/threading) for both SMTP and IMAP Sent/Draft append.
 */

import nodemailer from "nodemailer";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MailComposer = require("nodemailer/lib/mail-composer") as new (mail: Record<string, unknown>) => {
  compile: () => { build: () => Promise<Buffer> };
};
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

export type SendMailResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
  responseCode?: number;
  /** Full RFC822 for IMAP Sent append (BCC stripped). */
  rawForStore: Buffer;
};

function normalizeList(value?: string | string[]) {
  if (!value) return undefined;
  const list = (Array.isArray(value) ? value : value.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

/** Build storeable MIME without BCC (privacy) but with CC + attachments + threading. */
export async function buildRfc822(from: string, input: SendMailInput, opts?: { includeBcc?: boolean }) {
  const to = normalizeList(input.to) || [];
  const cc = normalizeList(input.cc);
  const bcc = opts?.includeBcc ? normalizeList(input.bcc) : undefined;
  const mail = new MailComposer({
    from,
    to,
    cc,
    bcc,
    subject: input.subject || "",
    text: input.text,
    html: input.html,
    inReplyTo: input.inReplyTo,
    references: input.references,
    attachments: input.attachments,
    messageId: undefined,
  });
  return mail.compile().build();
}

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

function formatSmtpError(error: unknown): Error {
  if (!error || typeof error !== "object") {
    return new Error(error instanceof Error ? error.message : "SMTP send failed");
  }
  const e = error as {
    message?: string;
    response?: string;
    responseCode?: number;
    code?: string;
    command?: string;
  };
  const parts = [
    e.responseCode ? `SMTP ${e.responseCode}` : null,
    e.response || e.message || "SMTP send failed",
    e.code ? `(${e.code})` : null,
    e.command ? `cmd=${e.command}` : null,
  ].filter(Boolean);
  const err = new Error(parts.join(" "));
  Object.assign(err, { status: 502, smtpCode: e.responseCode, smtpResponse: e.response });
  return err;
}

export async function sendMail(
  creds: WebmailCredentials,
  input: SendMailInput,
  opts?: { from?: string },
): Promise<SendMailResult> {
  const to = normalizeList(input.to);
  if (!to?.length) {
    throw Object.assign(new Error("At least one To recipient is required"), { status: 400 });
  }

  const fromHeader = opts?.from || creds.email;
  const transport = createSmtpTransport(creds);
  try {
    await transport.verify();
  } catch (error) {
    throw formatSmtpError(error);
  }

  try {
    const info = await transport.sendMail({
      from: fromHeader,
      to,
      cc: normalizeList(input.cc),
      bcc: normalizeList(input.bcc),
      subject: input.subject,
      text: input.text,
      html: input.html,
      inReplyTo: input.inReplyTo,
      references: input.references,
      attachments: input.attachments,
    });

    const accepted = (info.accepted || []).map(String);
    const rejected = (info.rejected || []).map(String);
    if (accepted.length === 0) {
      throw Object.assign(
        new Error(`SMTP accepted no recipients. Rejected: ${rejected.join(", ") || "none"}. ${info.response || ""}`),
        { status: 502 },
      );
    }

    const rawForStore = await buildRfc822(fromHeader, {
      ...input,
    });
    let stored = rawForStore;
    if (info.messageId) {
      const mid = String(info.messageId).replace(/^<|>$/g, "");
      const asStr = rawForStore.toString("utf8");
      if (/^Message-ID:/im.test(asStr)) {
        stored = Buffer.from(asStr.replace(/^Message-ID:.*$/im, `Message-ID: <${mid}>`), "utf8");
      } else {
        stored = Buffer.from(asStr.replace(/(\r?\n\r?\n)/, `\r\nMessage-ID: <${mid}>$1`), "utf8");
      }
    }

    return {
      messageId: String(info.messageId || ""),
      accepted,
      rejected,
      response: String(info.response || "250 OK"),
      responseCode: 250,
      rawForStore: stored,
    };
  } catch (error) {
    throw formatSmtpError(error);
  } finally {
    transport.close();
  }
}
