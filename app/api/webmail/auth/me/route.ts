import { ok, fail } from "@/lib/api/response";
import { getWebmailCredentials } from "@/services/webmail/session-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const creds = await getWebmailCredentials();
    if (!creds) return fail("Unauthorized", 401);
    const local = creds.email.split("@")[0] || creds.email;
    return ok({
      email: creds.email,
      name: local,
      online: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return fail(message, 400);
  }
}
