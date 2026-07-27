import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { getThreadMessages } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ uid: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const creds = await requireWebmailCredentials();
    const { uid } = await ctx.params;
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "INBOX";
    const threadId = searchParams.get("threadId") || uid;
    return ok(
      await getThreadMessages(creds, folder, threadId, Number(uid)),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
