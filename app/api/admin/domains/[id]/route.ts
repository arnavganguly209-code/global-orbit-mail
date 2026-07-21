import { ok, fail, parseJson } from "@/lib/api/response";
import { domainService } from "@/services/domains";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return ok(domainService.get(id));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Not found", 404);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseJson(request);
    return ok(domainService.update(id, body), undefined, "Domain updated");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Update failed", 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    domainService.remove(id);
    return ok({ id }, undefined, "Domain deleted");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Delete failed", 400);
  }
}
