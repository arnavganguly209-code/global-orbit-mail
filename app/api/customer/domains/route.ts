import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireCustomerActor, requireCustomerMutation } from "@/lib/api/actor";
import { domainService } from "@/services/domains";
import { toFriendlyDomainError } from "@/lib/api/domain-errors";

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
    const friendly = toFriendlyDomainError(error);
    return fail(friendly.message, friendly.status === 401 || friendly.status === 403 ? friendly.status : 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCustomerMutation(request);
    const body = await parseJson(request);
    const result = await domainService.createForOrganization(
      body,
      actor.organizationId!,
      actor.sub,
    );

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
