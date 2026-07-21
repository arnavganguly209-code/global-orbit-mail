import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminMutation } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const actor = await requireAdminMutation(request);
    const { id } = await params;
    const body = await parseJson<{ action?: string } & Record<string, unknown>>(request);
    if (body.action === "suspend") {
      return ok(await mailboxService.suspend(id, actor.sub), undefined, "Mailbox suspended");
    }
    if (body.action === "activate") {
      return ok(await mailboxService.activate(id, actor.sub), undefined, "Mailbox activated");
    }
    return ok(await mailboxService.update(id, body, actor.sub), undefined, "Mailbox updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return fail(
      message,
      message === "Unauthorized" ? 401 : message === "Invalid CSRF token" ? 403 : 400,
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  return PUT(request, { params });
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const actor = await requireAdminMutation(request);
    const { id } = await params;
    await mailboxService.remove(id, actor.sub);
    return ok({ id }, undefined, "Mailbox deleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return fail(
      message,
      message === "Unauthorized" ? 401 : message === "Invalid CSRF token" ? 403 : 400,
    );
  }
}
