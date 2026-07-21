import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { dashboardService, monitoringService } from "@/services/dashboard";

export async function GET() {
  try {
    await requireAdminActor();
    const [metrics, monitoring] = await Promise.all([
      dashboardService.getMetrics(),
      monitoringService.getSnapshot(),
    ]);
    return ok({ metrics, monitoring });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dashboard error";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 500);
  }
}
