import { ok, fail } from "@/lib/api/response";
import { webmailMailboxLogin } from "@/services/auth/webmail-mailbox-login";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const data = await webmailMailboxLogin(request);
    return ok(data, undefined, "Signed in");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    const status =
      typeof error === "object" &&
      error &&
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : 400;
    return fail(message, status);
  }
}
