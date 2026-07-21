import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { domainService } from "@/services/domains";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdminActor();
    const { id } = await params;
    return ok(await domainService.get(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    return fail(message, message === "Unauthorized" ? 401 : 404);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const actor = await requireAdminActor();
    const { id } = await params;
    const body = await parseJson(request);
    return ok(await domainService.update(id, body, actor.sub), undefined, "Domain updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  return PUT(request, { params });
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const actor = await requireAdminActor();
    const { id } = await params;
    await domainService.remove(id, actor.sub);
    return ok({ id }, undefined, "Domain deleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
