import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { domainService } from "@/services/domains";
import { toFriendlyDomainError } from "@/lib/api/domain-errors";

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    return ok(await domainService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    const friendly = toFriendlyDomainError(error);
    return fail(friendly.message, friendly.status === 401 || friendly.status === 403 ? friendly.status : 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    const body = await parseJson(request);
    const result = await domainService.create(body, actor.sub, null);

    if (result.alreadyExisted) {
      return ok(result, undefined, "This domain already exists in your account.");
    }
    if (result.restored) {
      return ok(result, undefined, "Domain restored successfully.");
    }
    return created(result, "Domain added successfully.");
  } catch (error) {
    const friendly = toFriendlyDomainError(error);
    return fail(friendly.message, friendly.status);
  }
}
