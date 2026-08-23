import { ok, fail, parseJson } from "@/lib/api/response";
import { webmailPasswordService } from "@/services/webmail/password";
import { CURRENT_PASSWORD_INCORRECT } from "@/lib/auth/password-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await parseJson(request);
    const data = await webmailPasswordService.changePassword(body);
    return ok(data, undefined, "Password changed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password change failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : message === CURRENT_PASSWORD_INCORRECT
          ? 403
          : message === "Unauthorized"
            ? 401
            : 400;
    return fail(message, Number.isFinite(status) && status > 0 ? status : 400);
  }
}
