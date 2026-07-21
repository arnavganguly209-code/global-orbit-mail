import { ok } from "@/lib/api/response";
import { monitoringService } from "@/services/dashboard";

export async function GET() {
  return ok(monitoringService.getSnapshot());
}
