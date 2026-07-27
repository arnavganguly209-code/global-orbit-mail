import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { searchMessages } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const folder = searchParams.get("folder") || "INBOX";
    const messages = await searchMessages(creds, folder, q);
    return ok({ messages, q });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
