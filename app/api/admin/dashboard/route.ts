import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { dashboardService, monitoringService } from "@/services/dashboard";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    const [metrics, monitoring, recentActivity, notifications] = await Promise.all([
      dashboardService.getMetrics(),
      monitoringService.getSnapshot(),
      dashboardService.getRecentActivity(12),
      dashboardService.getRecentNotifications(actor.sub, 8),
    ]);
    return ok({ metrics, monitoring, recentActivity, notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dashboard error";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 500);
  }
}
