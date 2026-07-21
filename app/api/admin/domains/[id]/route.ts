import { ok, fail, parseJson } from "@/lib/api/response";
import {
  requireAdminActor,
  requireAdminMutation,
  requireSuperAdminMutation,
} from "@/lib/api/actor";
import { domainService } from "@/services/domains";

type Params = { params: Promise<{ id: string }> };

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (
    message === "Forbidden" ||
    message === "Invalid CSRF token" ||
    message.startsWith("Forbidden:")
  )
    return 403;
  if (message === "Domain not found" || message === "Not found") return 404;
  return 400;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdminActor();
    const { id } = await params;
    return ok(await domainService.get(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    return fail(message, statusFor(message));
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const actor = await requireAdminMutation(request);
    const { id } = await params;
    const body = await parseJson(request);
    return ok(await domainService.update(id, body, actor.sub), undefined, "Domain updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return fail(message, statusFor(message));
  }
}

export async function PATCH(request: Request, { params }: Params) {
  return PUT(request, { params });
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const actor = await requireSuperAdminMutation(request);
    const { id } = await params;
    await domainService.remove(id, actor.sub);
    return ok({ id }, undefined, "Domain deleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return fail(message, statusFor(message));
  }
}
