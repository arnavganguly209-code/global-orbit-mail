import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { domainService } from "@/services/domains";

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (
    message === "Forbidden" ||
    message === "Invalid CSRF token" ||
    message.startsWith("Forbidden:")
  )
    return 403;
  return 400;
}

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    return ok(await domainService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list domains";
    return fail(message, statusFor(message));
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    const body = await parseJson(request);
    return created(
      await domainService.create(body, actor.sub, null),
      "Domain created and provisioned",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create domain";
    return fail(message, statusFor(message));
  }
}
