import { ok, fail } from "@/lib/api/response";
import { requireCustomerActor } from "@/lib/api/actor";
import { subscriptionService } from "@/services/customer/subscription";

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 400;
}

export async function GET() {
  try {
    const actor = await requireCustomerActor();
    const subscription = await subscriptionService.getForOrganization(actor.organizationId!);
    return ok({ subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load subscription";
    return fail(message, statusFor(message));
  }
}
