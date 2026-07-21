import { ok, fail, parseJson } from "@/lib/api/response";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseJson(request);
    return ok(mailboxService.update(id, body), undefined, "Mailbox updated");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Update failed", 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    mailboxService.remove(id);
    return ok({ id }, undefined, "Mailbox deleted");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Delete failed", 400);
  }
}
