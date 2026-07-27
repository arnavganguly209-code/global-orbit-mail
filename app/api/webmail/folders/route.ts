import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { listFolders } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

export async function GET() {
  try {
    const creds = await requireWebmailCredentials();
    const folders = await listFolders(creds);
    return ok({ folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
