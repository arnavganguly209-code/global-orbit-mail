import { ok, fail } from "@/lib/api/response";
import { requireAdminMutation } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string; aliasId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const actor = await requireAdminMutation(request);
    const { id, aliasId } = await params;
    await mailboxService.removeAlias(id, aliasId, actor.sub);
    return ok({ id: aliasId }, undefined, "Alias deleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alias delete failed";
    return fail(
      message,
      message === "Unauthorized" ? 401 : message === "Invalid CSRF token" ? 403 : 400,
    );
  }
}
