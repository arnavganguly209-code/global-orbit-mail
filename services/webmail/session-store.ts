/**
 * GLOBAL ORBIT MAIL — Webmail mailbox session (encrypted cookie)
 * Credentials never touch Prisma. Session is sealed with AUTH_SECRET.
 */

import { CompactEncrypt, compactDecrypt } from "jose";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

export const WEBMAIL_SESSION_COOKIE = "go_webmail_session";

export type WebmailCredentials = {
  email: string;
  password: string;
};

type SealedPayload = WebmailCredentials & {
  exp: number;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET || process.env.WEBMAIL_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is required for webmail sessions");
  }
  return createHash("sha256").update(secret).digest();
}

export function webmailSessionTtlSeconds(remember: boolean) {
  return remember ? 60 * 60 * 24 * 14 : 60 * 60 * 12;
}

export async function sealWebmailSession(
  creds: WebmailCredentials,
  ttlSeconds: number,
): Promise<string> {
  const payload: SealedPayload = {
    email: creds.email.toLowerCase().trim(),
    password: creds.password,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const jwe = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(secretKey());
  return jwe;
}

export async function unsealWebmailSession(token: string): Promise<WebmailCredentials | null> {
  try {
    const { plaintext } = await compactDecrypt(token, secretKey());
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as SealedPayload;
    if (!payload?.email || !payload?.password || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return { email: payload.email, password: payload.password };
  } catch {
    return null;
  }
}

export function webmailCookieOptions(ttlSeconds: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ttlSeconds,
  };
}

export async function getWebmailCredentials(): Promise<WebmailCredentials | null> {
  const jar = await cookies();
  const token = jar.get(WEBMAIL_SESSION_COOKIE)?.value;
  if (!token) return null;
  return unsealWebmailSession(token);
}

export async function requireWebmailCredentials(): Promise<WebmailCredentials> {
  const creds = await getWebmailCredentials();
  if (!creds) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return creds;
}
