import { fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { getRawMessage } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

type Params = { params: Promise<{ uid: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const creds = await requireWebmailCredentials();
    const { uid: uidStr } = await params;
    const uid = Number(uidStr);
    if (!Number.isFinite(uid)) return fail("Invalid uid", 400);
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "INBOX";
    const format = searchParams.get("format") || "eml";
    const { raw, subject } = await getRawMessage(creds, folder, uid);
    const safeName = subject.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || `message-${uid}`;

    if (format === "source" || format === "text") {
      return new Response(raw.toString("utf8"), {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    }

    return new Response(new Uint8Array(raw), {
      status: 200,
      headers: {
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="${safeName}.eml"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
