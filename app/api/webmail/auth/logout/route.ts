import { ok, fail } from "@/lib/api/response";
import { webmailMailboxLogout } from "@/services/auth/webmail-mailbox-login";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await webmailMailboxLogout();
    return ok(data, undefined, "Signed out");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logout failed";
    return fail(message, 400);
  }
}
