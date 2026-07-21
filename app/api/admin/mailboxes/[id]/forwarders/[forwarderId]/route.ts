import { ok, fail } from "@/lib/api/response";
import { requireAdminMutation } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string; forwarderId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const actor = await requireAdminMutation(request);
    const { id, forwarderId } = await params;
    await mailboxService.removeForwarder(id, forwarderId, actor.sub);
    return ok({ id: forwarderId }, undefined, "Forwarder deleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forwarder delete failed";
    return fail(
      message,
      message === "Unauthorized" ? 401 : message === "Invalid CSRF token" ? 403 : 400,
    );
  }
}
