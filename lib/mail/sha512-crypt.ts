import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Produce a Dovecot SHA512-CRYPT hash (`$6$…`).
 * Prefer live `doveadm pw` / `openssl passwd -6`, then pure JS (unixcrypt).
 * Never returns bcrypt or argon.
 */
export async function hashSha512Crypt(plain: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "doveadm",
      ["pw", "-s", "SHA512-CRYPT", "-p", plain],
      { timeout: 15_000 },
    );
    const hash = normalizeSha512Crypt(stdout.trim());
    if (hash) return hash;
  } catch {
    // not on mail host
  }

  try {
    const { stdout } = await execFileAsync("openssl", ["passwd", "-6", plain], {
      timeout: 15_000,
    });
    const hash = normalizeSha512Crypt(stdout.trim());
    if (hash) return hash;
  } catch {
    // Windows/dev without openssl -6
  }

  const { encrypt } = await import("unixcrypt");
  const salt = randomBytes(12).toString("base64url").slice(0, 16);
  return normalizeSha512Crypt(encrypt(plain, `$6$${salt}`))!;
}

/** Strip `{SHA512-CRYPT}` so MySQL/Dovecot see `$6$…` with default_pass_scheme. */
export function normalizeSha512Crypt(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const trimmed = hash.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^\{SHA512-CRYPT\}/i, "");
  if (stripped.startsWith("$6$")) return stripped;
  if (/^\{SHA512-CRYPT\}/i.test(trimmed)) return stripped;
  return null;
}

export function isSha512Crypt(hash: string): boolean {
  return Boolean(normalizeSha512Crypt(hash));
}
