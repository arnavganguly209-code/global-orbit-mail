import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/session";

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

  // Guarantee each class
  chars.push(LOWER[bytes[0]! % LOWER.length]!);
  chars.push(UPPER[bytes[1]! % UPPER.length]!);
  chars.push(DIGITS[bytes[2]! % DIGITS.length]!);
  chars.push(SYMBOLS[bytes[3]! % SYMBOLS.length]!);

  for (let i = chars.length; i < size; i++) {
    chars.push(alphabet[bytes[i]! % alphabet.length]!);
  }

  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i]! % (i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }

  return chars.join("");
}

/**
 * App-layer bcrypt hash + Dovecot BLF-CRYPT compatible string.
 *
 * Orbit and Dovecot MUST use the same scheme:
 *   - Algorithm: bcrypt (cost 12) via bcryptjs → `$2a$12$…` or `$2b$12$…`
 *   - Dovecot label: `{BLF-CRYPT}` prefix (see deploy/vps/dovecot-sql.conf.ext)
 *   - default_pass_scheme = BLF-CRYPT
 *
 * Never store plaintext. Never use SHA512-CRYPT / ARGON2 unless Dovecot is
 * reconfigured to match — Roundcube → IMAP auth will fail with "passdb: auth failed".
 */
export async function hashMailboxPassword(plain: string): Promise<{
  passwordHash: string;
  mailPasswordHash: string;
}> {
  const passwordHash = await hashPassword(plain);
  // Strip any accidental scheme prefix before re-applying BLF-CRYPT
  const raw = passwordHash.replace(/^\{[A-Z0-9-]+\}/i, "");
  const mailPasswordHash = `{BLF-CRYPT}${raw}`;
  return { passwordHash: raw, mailPasswordHash };
}
