import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { billingAdminService } from "@/services/billing/admin";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "billing:read");
    return ok(await billingAdminService.listPlans());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "billing:write");
    const body = await parseJson(request);
    return created(await billingAdminService.createPlan(body, actor.sub));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return fail(message, 400);
  }
}
