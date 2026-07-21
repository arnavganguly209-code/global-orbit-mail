import { ok, fail } from "@/lib/api/response";
import { requireCustomerActor } from "@/lib/api/actor";
import { subscriptionService } from "@/services/customer/subscription";

export async function GET() {
  try {
    const actor = await requireCustomerActor();
    const [subscription, orders, invoices] = await Promise.all([
      subscriptionService.getForOrganization(actor.organizationId!),
      subscriptionService.listOrders(actor.organizationId!),
      subscriptionService.listInvoices(actor.organizationId!),
    ]);
    return ok({ subscription, orders, invoices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load billing";
    return fail(message, message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400);
  }
}
