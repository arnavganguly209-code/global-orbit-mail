import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { getMessage } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

type Params = { params: Promise<{ uid: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const creds = await requireWebmailCredentials();
    const { uid: uidStr } = await params;
    const uid = Number(uidStr);
    if (!Number.isFinite(uid)) return fail("Invalid uid", 400);
    const folder = new URL(request.url).searchParams.get("folder") || "INBOX";
    const data = await getMessage(creds, folder, uid);
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
