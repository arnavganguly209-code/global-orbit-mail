import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireCustomerActor, requireCustomerMutation } from "@/lib/api/actor";
import { mailboxService } from "@/services/mailboxes";

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden" || message === "Invalid CSRF token") return 403;
  if (message === "Domain not found") return 404;
  return 400;
}

export async function GET(request: Request) {
  try {
    const actor = await requireCustomerActor();
    const { searchParams } = new URL(request.url);
    return ok(
      await mailboxService.listForOrganization(
        Object.fromEntries(searchParams.entries()),
        actor.organizationId!,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list mailboxes";
    return fail(message, statusFor(message));
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCustomerMutation(request);
    const body = await parseJson(request);
    return created(
      await mailboxService.createForOrganization(body, actor.organizationId!, actor.sub),
      "Mailbox created",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create mailbox";
    return fail(message, statusFor(message));
  }
}
