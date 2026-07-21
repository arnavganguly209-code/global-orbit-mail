import { randomBytes, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hashPassword } from "@/lib/auth/session";

const execFileAsync = promisify(execFile);

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*_-+=?";

/**
 * Generate a cryptographically secure mailbox password.
 * Default 20 chars, mixed character classes.
 */
export function generateSecurePassword(length = 20): string {
  const size = Math.max(12, Math.min(128, length));
  const alphabet = LOWER + UPPER + DIGITS + SYMBOLS;
  const bytes = randomBytes(size * 2);
  const chars: string[] = [];

  chars.push(LOWER[bytes[0]! % LOWER.length]!);
  chars.push(UPPER[bytes[1]! % UPPER.length]!);
  chars.push(DIGITS[bytes[2]! % DIGITS.length]!);
  chars.push(SYMBOLS[bytes[3]! % SYMBOLS.length]!);

  for (let i = chars.length; i < size; i++) {
    chars.push(alphabet[bytes[i]! % alphabet.length]!);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i]! % (i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }

  return chars.join("");
}

/**
 * Prefer hashing with live Dovecot (`doveadm pw`) / openssl SHA512-CRYPT.
 * Most production Dovecot stacks expect SHA512-CRYPT ($6$), NOT bcrypt.
 *
 * App-layer passwordHash remains bcrypt for any Orbit-side checks.
 * mailPasswordHash is what Dovecot SQL passdb must verify.
 *
 * Final authority on the mail VPS: deploy/vps/mail-agent.sh runs
 * `doveadm pw -s <detected_scheme>` and writes virtual_users.
 */
export async function hashMailboxPassword(plain: string): Promise<{
  passwordHash: string;
  mailPasswordHash: string;
}> {
  const passwordHash = await hashPassword(plain);
  const rawBcrypt = passwordHash.replace(/^\{[A-Z0-9-]+\}/i, "");

  const scheme = (process.env.DOVECOT_PASS_SCHEME ?? "SHA512-CRYPT").trim();
  let mailPasswordHash: string | null = null;

  try {
    const { stdout } = await execFileAsync("doveadm", ["pw", "-s", scheme, "-p", plain], {
      timeout: 15_000,
    });
    mailPasswordHash = stdout.trim() || null;
  } catch {
    // not on mail host
  }

  if (!mailPasswordHash) {
    try {
      const { stdout } = await execFileAsync("openssl", ["passwd", "-6", plain], {
        timeout: 15_000,
      });
      const hash = stdout.trim();
      if (hash) {
        mailPasswordHash = hash.startsWith("{") ? hash : `{SHA512-CRYPT}${hash}`;
      }
    } catch {
      // Windows/dev without openssl -6
    }
  }

  // Last resort: bcrypt with BLF-CRYPT label (only if Dovecot is configured for it).
  // Production agent will overwrite this with doveadm-native hash when password is provisioned.
  if (!mailPasswordHash) {
    mailPasswordHash = `{BLF-CRYPT}${rawBcrypt}`;
  }

  return { passwordHash: rawBcrypt, mailPasswordHash };
}

/** Deterministic marker so tests can assert scheme without doveadm. */
export function hashSchemeLabel(mailPasswordHash: string): string {
  if (mailPasswordHash.includes("SHA512") || mailPasswordHash.startsWith("$6$")) {
    return "SHA512-CRYPT";
  }
  if (mailPasswordHash.includes("BLF-CRYPT") || mailPasswordHash.startsWith("$2")) {
    return "BLF-CRYPT";
  }
  if (mailPasswordHash.includes("ARGON")) return "ARGON2";
  return createHash("sha1").update(mailPasswordHash).digest("hex").slice(0, 8);
}
