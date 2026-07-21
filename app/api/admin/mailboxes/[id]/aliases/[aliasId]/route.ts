import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string; aliasId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const actor = await requireAdminActor();
    const { id, aliasId } = await params;
    await mailboxService.removeAlias(id, aliasId, actor.sub);
    return ok({ id: aliasId }, undefined, "Alias deleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alias delete failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
