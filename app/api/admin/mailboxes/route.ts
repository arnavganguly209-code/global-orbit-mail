import { ok, fail, created, parseJson } from "@/lib/api/response";
import {
  requireAdminActor,
  requireSuperAdminMutation,
} from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (
    message === "Forbidden" ||
    message.startsWith("Forbidden:") ||
    message === "Invalid CSRF token"
  )
    return 403;
  return 400;
}

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    return ok(await mailboxService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list mailboxes";
    return fail(message, statusFor(message));
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    const body = await parseJson(request);
    return created(await mailboxService.create(body, actor.sub), "Mailbox created and provisioned");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create mailbox";
    return fail(message, statusFor(message));
  }
}
