import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { billingAdminService } from "@/services/billing/admin";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "billing:read");
    return ok(await billingAdminService.listCoupons());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "billing:write");
    return created(await billingAdminService.createCoupon(await parseJson(request), actor.sub));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
