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
 * bcryptjs hashes are `$2a$`/`$2b$` which Dovecot accepts as {BLF-CRYPT}.
 */
export async function hashMailboxPassword(plain: string): Promise<{
  passwordHash: string;
  mailPasswordHash: string;
}> {
  const passwordHash = await hashPassword(plain);
  const mailPasswordHash = passwordHash.startsWith("{")
    ? passwordHash
    : `{BLF-CRYPT}${passwordHash}`;
  return { passwordHash, mailPasswordHash };
}
