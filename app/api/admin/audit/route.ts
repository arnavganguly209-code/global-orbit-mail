import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { auditService } from "@/services/admin";

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    if (searchParams.get("export") === "csv") {
      const csv = await auditService.exportCsv();
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit-logs.csv"',
        },
      });
    }
    return ok(await auditService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit list failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
