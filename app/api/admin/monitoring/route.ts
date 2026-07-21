import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { monitoringService } from "@/services/dashboard";

export async function GET() {
  try {
    await requireAdminActor();
    return ok(await monitoringService.getSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monitoring failed";
    return fail(message, message === "Unauthorized" ? 401 : 500);
  }
}
