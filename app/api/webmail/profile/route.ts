import { ok, fail, parseJson } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { updateMailboxProfileByEmail } from "@/services/webmail/branding";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  displayName: z.string().trim().max(120).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  replyTo: z.union([z.string().email().max(190), z.literal(""), z.null()]).optional(),
  timezone: z.string().trim().max(80).nullable().optional(),
  language: z.string().trim().max(40).nullable().optional(),
  signatureHtml: z.string().max(50000).nullable().optional(),
  signatureText: z.string().max(20000).nullable().optional(),
  avatarUrl: z.string().max(1_500_000).nullable().optional(),
});

export async function PUT(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const body = schema.parse(await parseJson(request));
    const branding = await updateMailboxProfileByEmail(creds.email, body);
    return ok(branding, undefined, "Profile saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile update failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
