import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { listMessages } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "INBOX";
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || "50")));
    const data = await listMessages(creds, folder, page, pageSize);
    return ok(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
