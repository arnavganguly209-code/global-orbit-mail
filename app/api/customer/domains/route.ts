import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireCustomerActor, requireCustomerMutation } from "@/lib/api/actor";
import { domainService } from "@/services/domains";

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden" || message === "Invalid CSRF token") return 403;
  return 400;
}

export async function GET(request: Request) {
  try {
    const actor = await requireCustomerActor();
    const { searchParams } = new URL(request.url);
    return ok(
      await domainService.listForOrganization(
        Object.fromEntries(searchParams.entries()),
        actor.organizationId!,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list domains";
    return fail(message, statusFor(message));
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCustomerMutation(request);
    const body = await parseJson(request);
    return created(
      await domainService.createForOrganization(body, actor.organizationId!, actor.sub),
      "Domain added",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create domain";
    return fail(message, statusFor(message));
  }
}
