import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { listThreads } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "INBOX";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 50);
    return ok(await listThreads(creds, folder, page, pageSize));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
