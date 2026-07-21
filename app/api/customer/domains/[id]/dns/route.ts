import { ok, fail } from "@/lib/api/response";
import { requireCustomerActor } from "@/lib/api/actor";
import { domainService } from "@/services/domains";
import { dnsRepository } from "@/repositories";

type Params = { params: Promise<{ id: string }> };

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  if (message === "Domain not found") return 404;
  return 400;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireCustomerActor();
    const { id } = await params;
    await domainService.getForOrganization(id, actor.organizationId!);
    return ok(await dnsRepository.listByDomain(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load DNS records";
    return fail(message, statusFor(message));
  }
}
