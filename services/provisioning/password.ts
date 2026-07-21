import { randomBytes, createHash } from "node:crypto";
import { hashPassword } from "@/lib/auth/session";
import { hashSha512Crypt, isSha512Crypt } from "@/lib/mail/sha512-crypt";

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
 * App-layer passwordHash: bcrypt (Orbit only).
 * mailPasswordHash: SHA512-CRYPT `$6$…` for Dovecot MySQL passdb.
 * Never stores bcrypt/argon in mailPasswordHash.
 */
export async function hashMailboxPassword(plain: string): Promise<{
  passwordHash: string;
  mailPasswordHash: string;
}> {
  const passwordHash = await hashPassword(plain);
  const rawBcrypt = passwordHash.replace(/^\{[A-Z0-9-]+\}/i, "");
  const mailPasswordHash = await hashSha512Crypt(plain);

  if (!isSha512Crypt(mailPasswordHash)) {
    throw new Error("Failed to produce SHA512-CRYPT hash for Dovecot");
  }

  return { passwordHash: rawBcrypt, mailPasswordHash };
}

/** Deterministic marker so tests can assert scheme without doveadm. */
export function hashSchemeLabel(mailPasswordHash: string): string {
  if (isSha512Crypt(mailPasswordHash) || mailPasswordHash.includes("SHA512")) {
    return "SHA512-CRYPT";
  }
  if (mailPasswordHash.includes("BLF-CRYPT") || mailPasswordHash.startsWith("$2")) {
    return "BLF-CRYPT";
  }
  if (mailPasswordHash.includes("ARGON")) return "ARGON2";
  return createHash("sha1").update(mailPasswordHash).digest("hex").slice(0, 8);
}
