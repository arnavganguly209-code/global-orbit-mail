import { existsSync, mkdirSync, writeFileSync, chmodSync, chownSync } from "node:fs";
import { join } from "node:path";

function vmailBase(): string {
  return (process.env.VMAIL_BASE ?? "/var/mail/vhosts").replace(/\/$/, "");
}

export function vmailHomeForEmail(email: string): string {
  const [local, domain] = email.toLowerCase().trim().split("@");
  if (!local || !domain) return `${vmailBase()}/unknown`;
  return `${vmailBase()}/${domain}/${local}`;
}

/** Create Maildir layout on the local mail VPS (Node fallback when mail-agent is unavailable). */
export function ensureLocalMaildir(email: string): {
  ok: boolean;
  home: string;
  error?: string;
} {
  const home = vmailHomeForEmail(email);
  const uid = Number(process.env.VMAIL_UID ?? "5000");
  const gid = Number(process.env.VMAIL_GID ?? "5000");
  const folders = [
    "",
    "cur",
    "new",
    "tmp",
    ".Drafts",
    ".Drafts/cur",
    ".Drafts/new",
    ".Drafts/tmp",
    ".Sent",
    ".Sent/cur",
    ".Sent/new",
    ".Sent/tmp",
    ".Junk",
    ".Junk/cur",
    ".Junk/new",
    ".Junk/tmp",
    ".Trash",
    ".Trash/cur",
    ".Trash/new",
    ".Trash/tmp",
  ];

  try {
    for (const rel of folders) {
      const path = rel ? join(home, rel) : home;
      mkdirSync(path, { recursive: true });
    }
    const subscriptions = join(home, "subscriptions");
    if (!existsSync(subscriptions)) {
      writeFileSync(subscriptions, "INBOX\nDrafts\nSent\nJunk\nTrash\n", "utf8");
    }
    try {
      chmodSync(home, 0o770);
      chownSync(home, uid, gid);
    } catch {
      // chown may fail outside root
    }
    return { ok: true, home };
  } catch (error) {
    return {
      ok: false,
      home,
      error: error instanceof Error ? error.message : "maildir create failed",
    };
  }
}

export function maildirExists(email: string): boolean {
  const home = vmailHomeForEmail(email);
  return (
    existsSync(join(home, "cur")) &&
    existsSync(join(home, "new")) &&
    existsSync(join(home, "tmp"))
  );
}
