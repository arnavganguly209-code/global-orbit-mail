import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { billingAdminService } from "@/services/billing/admin";
import { analyticsService } from "@/services/analytics";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "billing:read");
    const [summary, revenueSeries] = await Promise.all([
      billingAdminService.getRevenueSummary(),
      analyticsService.getRevenueSeries(90),
    ]);
    return ok({ summary, revenueSeries });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
