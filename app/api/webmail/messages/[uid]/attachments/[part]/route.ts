import { NextResponse } from "next/server";
import { fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { getAttachment } from "@/services/webmail/mailbox";

export const runtime = "nodejs";

type Params = { params: Promise<{ uid: string; part: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const creds = await requireWebmailCredentials();
    const { uid: uidStr, part } = await params;
    const uid = Number(uidStr);
    const partIndex = Number(part);
    if (!Number.isFinite(uid) || !Number.isFinite(partIndex)) return fail("Invalid params", 400);
    const folder = new URL(request.url).searchParams.get("folder") || "INBOX";
    const file = await getAttachment(creds, folder, uid, partIndex);
    return new NextResponse(new Uint8Array(file.content), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
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
