import { ok, fail } from "@/lib/api/response";
import { dashboardService, monitoringService } from "@/services/dashboard";

export async function GET() {
  try {
    return ok({
      metrics: dashboardService.getMetrics(),
      monitoring: monitoringService.getSnapshot(),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Dashboard error", 500);
  }
}
