import { ok, fail, parseJson } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { saveDraft } from "@/services/webmail/mailbox";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  to: z.union([z.string(), z.array(z.string())]).optional().default(""),
  subject: z.string().default(""),
  text: z.string().optional(),
  html: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const body = schema.parse(await parseJson(request));
    const data = await saveDraft(creds, {
      to: body.to || "",
      subject: body.subject,
      text: body.text,
      html: body.html,
    });
    return ok(data, undefined, "Draft saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
