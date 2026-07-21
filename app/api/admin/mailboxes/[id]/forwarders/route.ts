import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireAdminMutation } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdminActor();
    const { id } = await params;
    return ok(await mailboxService.listForwarders(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list forwarders";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireAdminMutation(request);
    const { id } = await params;
    const body = await parseJson(request);
    return ok(
      await mailboxService.addForwarder(id, body, actor.sub),
      undefined,
      "Forwarder created",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forwarder create failed";
    return fail(
      message,
      message === "Unauthorized" ? 401 : message === "Invalid CSRF token" ? 403 : 400,
    );
  }
}
