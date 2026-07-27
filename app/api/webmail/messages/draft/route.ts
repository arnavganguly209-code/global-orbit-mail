import { ok, fail, parseJson } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { saveDraft } from "@/services/webmail/mailbox";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  to: z.union([z.string(), z.array(z.string())]).optional().default(""),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  subject: z.string().default(""),
  text: z.string().optional(),
  html: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        contentBase64: z.string().min(1),
        contentType: z.string().optional(),
      }),
    )
    .max(20)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const body = schema.parse(await parseJson(request));
    const attachments = body.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, "base64"),
      contentType: a.contentType,
    }));
    const data = await saveDraft(creds, {
      to: body.to || "",
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      text: body.text,
      html: body.html,
      inReplyTo: body.inReplyTo,
      references: body.references,
      attachments,
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
