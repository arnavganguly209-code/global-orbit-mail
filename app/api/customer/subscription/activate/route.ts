import { ok, fail, parseJson } from "@/lib/api/response";
import { requireCustomerMutation } from "@/lib/api/actor";
import { subscriptionService } from "@/services/customer/subscription";

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden" || message === "Invalid CSRF token") return 403;
  if (message === "Plan not found") return 404;
  return 400;
}

export async function POST(request: Request) {
  try {
    const actor = await requireCustomerMutation(request);
    const body = await parseJson(request);
    const subscription = await subscriptionService.activate(
      body,
      actor.organizationId!,
      actor.sub,
    );
    return ok({ subscription }, undefined, "Payment complete — subscription activated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation failed";
    return fail(message, statusFor(message));
  }
}
