import { ok, fail, parseJson } from "@/lib/api/response";
import { requireSuperAdminMutation } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireSuperAdminMutation(request);
    const { id } = await params;
    const body = await parseJson(request);
    return ok(
      await mailboxService.resetPassword(id, body, actor.sub),
      undefined,
      "Password reset provisioned",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return fail(
      message,
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden") || message === "Invalid CSRF token"
          ? 403
          : 400,
    );
  }
}
