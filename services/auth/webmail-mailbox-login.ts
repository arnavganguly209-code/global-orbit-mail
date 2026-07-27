import { cookies } from "next/headers";
import { z } from "zod";
import { verifyMailboxLogin } from "@/services/webmail/imap-client";
import {
  sealWebmailSession,
  webmailCookieOptions,
  webmailSessionTtlSeconds,
  WEBMAIL_SESSION_COOKIE,
} from "@/services/webmail/session-store";
import { touchMailboxLastLogin } from "@/services/webmail/branding";

const loginBodySchema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(1).max(256),
  remember: z.boolean().optional().default(false),
});

export async function webmailMailboxLogin(request: Request) {
  const body = loginBodySchema.parse(await request.json());
  const email = body.email.toLowerCase().trim();
  const password = body.password;

  const ok = await verifyMailboxLogin(email, password);
  if (!ok) {
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }

  const ttl = webmailSessionTtlSeconds(Boolean(body.remember));
  const token = await sealWebmailSession({ email, password }, ttl);
  const jar = await cookies();
  jar.set(WEBMAIL_SESSION_COOKIE, token, webmailCookieOptions(ttl));

  void touchMailboxLastLogin(email).catch(() => undefined);

  const { bumpMailDailyStat } = await import("@/lib/mail/daily-stats");
  void bumpMailDailyStat("loginCount").catch(() => undefined);

  return {
    email,
    remember: Boolean(body.remember),
  };
}

export async function webmailMailboxLogout() {
  const jar = await cookies();
  jar.set(WEBMAIL_SESSION_COOKIE, "", { ...webmailCookieOptions(0), maxAge: 0 });
  return { ok: true };
}
