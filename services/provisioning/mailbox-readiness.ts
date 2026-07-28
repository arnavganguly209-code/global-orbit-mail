/**
 * Post-provision gates: SMTP RCPT, IMAP LOGIN, Maildir layout.
 * All three must pass before a mailbox is considered Ready.
 */

import { createConnection } from "node:net";
import { ImapFlow } from "imapflow";
import { maildirExists } from "@/services/provisioning/maildir";

export type MailboxReadinessResult = {
  ok: boolean;
  smtpRcpt: { ok: boolean; detail: string };
  imapLogin: { ok: boolean; detail: string };
  maildir: { ok: boolean; detail: string };
  errors: string[];
};

function smtpHost(): string {
  return process.env.MAIL_SMTP_HOST?.trim() || "127.0.0.1";
}

function smtpPort(): number {
  return Number(process.env.MAIL_SMTP_PORT ?? "25");
}

function imapHost(): string {
  return process.env.WEBMAIL_IMAP_HOST?.trim() || "127.0.0.1";
}

function imapPort(): number {
  return Number(process.env.WEBMAIL_IMAP_PORT ?? "143");
}

/** Minimal SMTP dialogue: EHLO → MAIL FROM:<> → RCPT TO:<email> — expect 250 (not 550). */
export async function testSmtpRcpt(email: string): Promise<{ ok: boolean; detail: string }> {
  const host = smtpHost();
  const port = smtpPort();
  const normalized = email.toLowerCase().trim();

  return new Promise((resolve) => {
    const lines: string[] = [];
    let buffer = "";
    let step: "banner" | "ehlo" | "mail" | "rcpt" | "done" = "banner";
    let settled = false;

    const finish = (ok: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve({ ok, detail });
    };

    const socket = createConnection({ host, port }, () => {
      /* wait for banner */
    });

    const timer = setTimeout(() => {
      finish(false, `SMTP RCPT timed out on ${host}:${port}`);
    }, 12_000);

    const send = (cmd: string) => {
      socket.write(`${cmd}\r\n`);
    };

    const onLine = (line: string) => {
      lines.push(line);
      const code = Number(line.slice(0, 3));
      const cont = line[3] === "-";

      if (step === "banner") {
        if (cont) return;
        if (code !== 220) {
          clearTimeout(timer);
          finish(false, `SMTP banner unexpected: ${line}`);
          return;
        }
        step = "ehlo";
        send(`EHLO orbit-ready.local`);
        return;
      }

      if (step === "ehlo") {
        if (cont) return;
        if (code !== 250) {
          clearTimeout(timer);
          finish(false, `EHLO failed: ${line}`);
          return;
        }
        step = "mail";
        send(`MAIL FROM:<>`);
        return;
      }

      if (step === "mail") {
        if (cont) return;
        if (code !== 250) {
          clearTimeout(timer);
          finish(false, `MAIL FROM failed: ${line}`);
          return;
        }
        step = "rcpt";
        send(`RCPT TO:<${normalized}>`);
        return;
      }

      if (step === "rcpt") {
        if (cont) return;
        clearTimeout(timer);
        step = "done";
        try {
          socket.write("QUIT\r\n");
        } catch {
          /* ignore */
        }
        if (code === 250) {
          finish(true, `RCPT accepted (${line})`);
        } else if (code === 550) {
          finish(false, `RCPT rejected 550 User unknown: ${line}`);
        } else {
          finish(false, `RCPT unexpected ${code}: ${line}`);
        }
      }
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const raw = buffer.slice(0, idx).replace(/\r$/, "");
        buffer = buffer.slice(idx + 1);
        if (raw) onLine(raw);
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      finish(false, `SMTP connect failed: ${err.message}`);
    });

    socket.on("close", () => {
      clearTimeout(timer);
      if (!settled) {
        finish(false, `SMTP closed early: ${lines.slice(-3).join(" | ") || "no response"}`);
      }
    });
  });
}

export async function testImapLogin(
  email: string,
  password: string,
): Promise<{ ok: boolean; detail: string }> {
  const host = imapHost();
  const port = imapPort();
  const secure =
    process.env.WEBMAIL_IMAP_SECURE === "true" ||
    port === 993 ||
    process.env.WEBMAIL_IMAP_TLS === "true";

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user: email.toLowerCase().trim(), pass: password },
    logger: false,
    tls: { rejectUnauthorized: process.env.WEBMAIL_IMAP_TLS_REJECT === "true" },
  });

  try {
    await client.connect();
    try {
      await client.logout();
    } catch {
      client.close();
    }
    return { ok: true, detail: `IMAP LOGIN ok on ${host}:${port}` };
  } catch (error) {
    try {
      client.close();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      detail:
        error instanceof Error
          ? `IMAP LOGIN failed: ${error.message}`
          : "IMAP LOGIN failed",
    };
  }
}

export async function checkMailboxReadiness(input: {
  email: string;
  password?: string;
}): Promise<MailboxReadinessResult> {
  const email = input.email.toLowerCase().trim();
  const errors: string[] = [];

  const smtpRcpt = await testSmtpRcpt(email);
  if (!smtpRcpt.ok) errors.push(smtpRcpt.detail);

  let imapLogin: { ok: boolean; detail: string };
  if (input.password) {
    imapLogin = await testImapLogin(email, input.password);
    if (!imapLogin.ok) errors.push(imapLogin.detail);
  } else {
    imapLogin = {
      ok: false,
      detail: "IMAP LOGIN skipped — plaintext password not available",
    };
    errors.push(imapLogin.detail);
  }

  const dirOk = maildirExists(email);
  const maildir = {
    ok: dirOk,
    detail: dirOk
      ? "Maildir cur/new/tmp present"
      : "Maildir missing (cur/new/tmp not found under VMAIL_BASE)",
  };
  if (!maildir.ok) errors.push(maildir.detail);

  return {
    ok: errors.length === 0,
    smtpRcpt,
    imapLogin,
    maildir,
    errors,
  };
}
