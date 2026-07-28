/**
 * Post-provision gates — mailbox is Ready only when all pass:
 * 1. IMAP LOGIN
 * 2. SMTP AUTH
 * 3. Postfix virtual mailbox lookup (MySQL + postmap)
 * 4. Maildir exists
 */

import { createConnection } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ImapFlow } from "imapflow";
import { maildirExists, vmailHomeForEmail } from "@/services/provisioning/maildir";
import { mysqlVirtualUserExists } from "@/services/provisioning/mysql-mail-auth";

const execFileAsync = promisify(execFile);

export type CheckResult = { ok: boolean; detail: string };

export type MailboxReadinessResult = {
  ok: boolean;
  imapLogin: CheckResult;
  smtpAuth: CheckResult;
  postfixVirtual: CheckResult;
  maildir: CheckResult;
  /** Kept for diagnostics — RCPT proves Postfix accepts delivery */
  smtpRcpt: CheckResult;
  errors: string[];
};

function smtpSubmissionHost(): string {
  return (
    process.env.WEBMAIL_SMTP_HOST?.trim() ||
    process.env.MAIL_SMTP_HOST?.trim() ||
    "127.0.0.1"
  );
}

function smtpSubmissionPort(): number {
  return Number(process.env.WEBMAIL_SMTP_PORT ?? "465");
}

function smtpRcptHost(): string {
  return process.env.MAIL_SMTP_HOST?.trim() || "127.0.0.1";
}

function smtpRcptPort(): number {
  return Number(process.env.MAIL_SMTP_PORT ?? "25");
}

function imapHost(): string {
  return process.env.WEBMAIL_IMAP_HOST?.trim() || "127.0.0.1";
}

function imapPort(): number {
  return Number(process.env.WEBMAIL_IMAP_PORT ?? "143");
}

function readSmtpLines(
  socket: NodeJS.ReadableStream,
  onLine: (line: string) => void,
): void {
  let buffer = "";
  socket.on("data", (chunk: Buffer | string) => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const raw = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (raw) onLine(raw);
    }
  });
}

/** Minimal SMTP dialogue: EHLO → MAIL FROM:<> → RCPT TO:<email> — expect 250 (not 550). */
export async function testSmtpRcpt(email: string): Promise<CheckResult> {
  const host = smtpRcptHost();
  const port = smtpRcptPort();
  const normalized = email.toLowerCase().trim();

  return new Promise((resolve) => {
    const lines: string[] = [];
    let step: "banner" | "ehlo" | "mail" | "rcpt" | "done" = "banner";
    let settled = false;

    const finish = (ok: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve({ ok, detail });
    };

    const socket = createConnection({ host, port });
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
          finish(false, `MAIL FROM failed: ${line}`);
          return;
        }
        step = "rcpt";
        send(`RCPT TO:<${normalized}>`);
        return;
      }

      if (step === "rcpt") {
        if (cont) return;
        step = "done";
        try {
          socket.write("QUIT\r\n");
        } catch {
          /* ignore */
        }
        if (code === 250 || code === 251) {
          finish(true, `RCPT accepted (${line})`);
        } else {
          finish(
            false,
            `Postfix rejected recipient (${line}) — missing virtual mailbox`,
          );
        }
      }
    };

    readSmtpLines(socket, onLine);
    socket.on("error", (err) => {
      finish(false, `SMTP connect failed: ${err.message}`);
    });
    socket.on("close", () => {
      if (!settled) {
        finish(false, `SMTP closed early: ${lines.slice(-3).join(" | ") || "no response"}`);
      }
    });
  });
}

/**
 * SMTP AUTH on submission (465 SSL or 587 STARTTLS).
 * Proves Dovecot SASL + virtual_users password are live for outbound.
 */
export async function testSmtpAuth(
  email: string,
  password: string,
): Promise<CheckResult> {
  const host = smtpSubmissionHost();
  const port = smtpSubmissionPort();
  const user = email.toLowerCase().trim();
  const secure =
    process.env.WEBMAIL_SMTP_SECURE === "true" ||
    port === 465 ||
    process.env.WEBMAIL_SMTP_TLS === "ssl";

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure && port === 587,
      auth: { user, pass: password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 12_000,
    });
    await transport.verify();
    transport.close();
    return { ok: true, detail: `SMTP AUTH ok on ${host}:${port}` };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error
          ? `SMTP AUTH failed: ${error.message}`
          : "SMTP AUTH failed",
    };
  }
}

export async function testImapLogin(
  email: string,
  password: string,
): Promise<CheckResult> {
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
    tls: { rejectUnauthorized: false },
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

/** postmap -q against Postfix mysql virtual_mailbox_maps (or MySQL fallback). */
export async function testPostfixVirtualMailbox(
  email: string,
): Promise<CheckResult> {
  const normalized = email.toLowerCase().trim();
  const mapPath =
    process.env.POSTFIX_VIRTUAL_MAILBOX_MAP?.trim() ||
    "mysql:/etc/postfix/mysql/mysql-virtual-users.cf";

  try {
    const { stdout, stderr } = await execFileAsync(
      "postmap",
      ["-q", normalized, mapPath],
      { timeout: 10_000, maxBuffer: 64 * 1024 },
    );
    const out = `${stdout}\n${stderr}`.trim();
    if (out.length > 0) {
      return {
        ok: true,
        detail: `Postfix virtual mailbox map hit (${mapPath})`,
      };
    }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim();
    // postmap returns exit 1 when key missing — empty stdout
    if (out.length > 0 && !/not found|No such/i.test(out)) {
      // unexpected postmap error — fall through to MySQL
      console.warn("[readiness:postmap]", out || err.message);
    }
  }

  const mysql = await mysqlVirtualUserExists(normalized);
  if (!mysql.ok) {
    return {
      ok: false,
      detail:
        mysql.error ||
        "Postfix virtual mailbox lookup failed (postmap empty and MySQL unreachable)",
    };
  }
  if (!mysql.exists) {
    return {
      ok: false,
      detail: `User unknown in virtual mailbox table (${normalized})`,
    };
  }
  return {
    ok: true,
    detail: "virtual_users row present in MariaDB mailserver",
  };
}

export async function checkMailboxReadiness(input: {
  email: string;
  password?: string;
  /** When true, skip SMTP AUTH / IMAP if password missing (hash-only ops). Default false. */
  allowWithoutPassword?: boolean;
}): Promise<MailboxReadinessResult> {
  const email = input.email.toLowerCase().trim();
  const errors: string[] = [];

  const postfixVirtual = await testPostfixVirtualMailbox(email);
  if (!postfixVirtual.ok) errors.push(postfixVirtual.detail);

  const smtpRcpt = await testSmtpRcpt(email);
  if (!smtpRcpt.ok) errors.push(smtpRcpt.detail);

  const dirOk = maildirExists(email);
  const maildir: CheckResult = {
    ok: dirOk,
    detail: dirOk
      ? `Maildir present at ${vmailHomeForEmail(email)}`
      : `Maildir missing at ${vmailHomeForEmail(email)}`,
  };
  if (!maildir.ok) errors.push(maildir.detail);

  let imapLogin: CheckResult;
  let smtpAuth: CheckResult;

  if (input.password) {
    imapLogin = await testImapLogin(email, input.password);
    if (!imapLogin.ok) errors.push(imapLogin.detail);

    smtpAuth = await testSmtpAuth(email, input.password);
    if (!smtpAuth.ok) errors.push(smtpAuth.detail);
  } else if (input.allowWithoutPassword) {
    imapLogin = { ok: true, detail: "IMAP LOGIN skipped (no plaintext password)" };
    smtpAuth = { ok: true, detail: "SMTP AUTH skipped (no plaintext password)" };
  } else {
    imapLogin = {
      ok: false,
      detail: "IMAP LOGIN skipped — plaintext password not available",
    };
    smtpAuth = {
      ok: false,
      detail: "SMTP AUTH skipped — plaintext password not available",
    };
    errors.push(imapLogin.detail);
    errors.push(smtpAuth.detail);
  }

  return {
    ok: errors.length === 0,
    imapLogin,
    smtpAuth,
    postfixVirtual,
    maildir,
    smtpRcpt,
    errors,
  };
}
