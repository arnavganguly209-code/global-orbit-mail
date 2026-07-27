import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { billingAdminService } from "@/services/billing/admin";

export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "billing:read");
    const { searchParams } = new URL(request.url);
    return ok(
      await billingAdminService.listOrders({
        page: Number(searchParams.get("page") || 1),
        pageSize: Number(searchParams.get("pageSize") || 25),
        status: searchParams.get("status") || undefined,
      }),
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
