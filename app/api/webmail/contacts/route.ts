import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { listRecentRecipients } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

/** Address book seed from recent IMAP envelopes (Sent + Inbox). */
export async function GET() {
  try {
    const creds = await requireWebmailCredentials();
    const recent = await listRecentRecipients(creds, 50);
    return ok({
      contacts: recent.map((email) => ({ email, name: email.split("@")[0] || email })),
      recent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contacts failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
