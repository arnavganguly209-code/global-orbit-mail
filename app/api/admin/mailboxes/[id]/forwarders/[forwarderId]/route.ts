import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string; forwarderId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const actor = await requireAdminActor();
    const { id, forwarderId } = await params;
    await mailboxService.removeForwarder(id, forwarderId, actor.sub);
    return ok({ id: forwarderId }, undefined, "Forwarder deleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forwarder delete failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
