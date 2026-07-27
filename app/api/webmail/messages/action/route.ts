import { ok, fail, parseJson } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { applyMessageAction, spamOrArchive } from "@/services/webmail/mailbox";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["delete", "move", "copy", "flag", "seen", "spam", "archive"]),
  folder: z.string().default("INBOX"),
  uids: z.array(z.number().int().positive()).min(1),
  target: z.string().optional(),
  flagged: z.boolean().optional(),
  seen: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const body = schema.parse(await parseJson(request));
    if (body.action === "spam") {
      return ok(await spamOrArchive(creds, body.folder, body.uids, "Junk"), undefined, "Moved to Spam");
    }
    if (body.action === "archive") {
      return ok(await spamOrArchive(creds, body.folder, body.uids, "Archive"), undefined, "Archived");
    }
    if (body.action === "delete") {
      return ok(
        await applyMessageAction(creds, { type: "delete", folder: body.folder, uids: body.uids }),
        undefined,
        "Deleted",
      );
    }
    if (body.action === "move" || body.action === "copy") {
      if (!body.target) return fail("target required", 400);
      return ok(
        await applyMessageAction(creds, {
          type: body.action,
          folder: body.folder,
          uids: body.uids,
          target: body.target,
        }),
        undefined,
        body.action === "move" ? "Moved" : "Copied",
      );
    }
    if (body.action === "flag") {
      return ok(
        await applyMessageAction(creds, {
          type: "flag",
          folder: body.folder,
          uids: body.uids,
          flagged: Boolean(body.flagged),
        }),
        undefined,
        body.flagged ? "Starred" : "Unstarred",
      );
    }
    return ok(
      await applyMessageAction(creds, {
        type: "seen",
        folder: body.folder,
        uids: body.uids,
        seen: body.seen !== false,
      }),
      undefined,
      body.seen === false ? "Marked unread" : "Marked read",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
