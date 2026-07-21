import { ok, fail } from "@/lib/api/response";
import { requireCustomerActor } from "@/lib/api/actor";
import { subscriptionService } from "@/services/customer/subscription";

export async function GET() {
  try {
    await requireCustomerActor();
    return ok(await subscriptionService.listPlans());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load plans";
    return fail(message, message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400);
  }
}
