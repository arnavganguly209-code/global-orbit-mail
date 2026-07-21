import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireAdminMutation } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    return ok(await mailboxService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list mailboxes";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminMutation(request);
    const body = await parseJson(request);
    return created(await mailboxService.create(body, actor.sub), "Mailbox created");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create mailbox";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
