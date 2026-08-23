import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/session";
import {
  changePasswordBodySchema,
  CURRENT_PASSWORD_INCORRECT,
  firstZodMessage,
} from "@/lib/auth/password-policy";
import { writeAudit } from "@/lib/audit";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import {
  requireWebmailCredentials,
  sealWebmailSession,
  webmailCookieOptions,
  webmailSessionTtlSeconds,
  WEBMAIL_SESSION_COOKIE,
} from "@/services/webmail/session-store";

function parseMailboxEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  const at = normalized.lastIndexOf("@");
  if (at < 1) return null;
  return {
    localPart: normalized.slice(0, at),
    domainName: normalized.slice(at + 1),
  };
}

export const webmailPasswordService = {
  async changePassword(body: unknown) {
    const creds = await requireWebmailCredentials();
    let input;
    try {
      input = changePasswordBodySchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) throw new Error(firstZodMessage(error));
      throw error;
    }

    const parts = parseMailboxEmail(creds.email);
    if (!parts) throw new Error("Unauthorized");

    const mailbox = await prisma.mailbox.findFirst({
      where: {
        deletedAt: null,
        localPart: { equals: parts.localPart, mode: "insensitive" },
        domain: { name: { equals: parts.domainName, mode: "insensitive" }, deletedAt: null },
      },
      select: { id: true, passwordHash: true, status: true },
    });
    if (!mailbox || mailbox.status === "SUSPENDED") {
      throw new Error("Mailbox not found");
    }

    if (!mailbox.passwordHash) {
      throw new Error(CURRENT_PASSWORD_INCORRECT);
    }
    const currentOk = await verifyPassword(input.currentPassword, mailbox.passwordHash);
    if (!currentOk) {
      throw new Error(CURRENT_PASSWORD_INCORRECT);
    }

    const updated = await mailboxRepository.resetPassword(
      mailbox.id,
      input.newPassword,
      null,
    );
    if (!updated) {
      throw new Error("Unable to update password");
    }

    const ttl = webmailSessionTtlSeconds(false);
    const token = await sealWebmailSession(
      { email: creds.email, password: input.newPassword },
      ttl,
    );
    const jar = await cookies();
    jar.set(WEBMAIL_SESSION_COOKIE, token, webmailCookieOptions(ttl));

    await writeAudit({
      actorId: null,
      action: "webmail.password_change",
      resource: "mailbox",
      resourceId: mailbox.id,
      metadata: { email: creds.email },
    });

    return { changed: true };
  },
};
