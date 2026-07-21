import { ok, fail } from "@/lib/api/response";
import { auditService } from "@/services/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("export") === "csv") {
      const csv = auditService.exportCsv();
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit-logs.csv"',
        },
      });
    }
    return ok(auditService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Audit list failed", 400);
  }
}
