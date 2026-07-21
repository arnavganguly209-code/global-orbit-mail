import { ok, fail } from "@/lib/api/response";
import { requireCustomerActor } from "@/lib/api/actor";
import { domainService } from "@/services/domains";
import { getDomainDnsPayload } from "@/services/dns/engine";

type Params = { params: Promise<{ id: string }> };

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  if (message === "Domain not found") return 404;
  return 400;
}

/** Returns Google-style DNS wizard payload for the customer domain. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireCustomerActor();
    const { id } = await params;
    await domainService.getForOrganization(id, actor.organizationId!);
    const payload = await getDomainDnsPayload(id);
    if (!payload) return fail("Domain not found", 404);
    return ok(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load DNS records";
    return fail(message, statusFor(message));
  }
}
