import { ok, fail, parseJson } from "@/lib/api/response";
import { requireSuperAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { verifyService } from "@/services/dns/admin";
import { assertApiRateLimit } from "@/lib/api/rate-limit";
import { requestAuditContext, writeAudit } from "@/lib/audit";

/**
 * POST /api/admin/verify — Super Admin only
 */
export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    await assertApiRateLimit(`verify:${actor.sub}`, 30, 60_000);
    const body = await parseJson(request);
    const ctx = requestAuditContext(request);
    const report = await verifyService.verify(body, actor.sub);
    await writeAudit({
      actorId: actor.sub,
      action: "dns.verify",
      resource: "domain",
      resourceId: report.domainId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      status: report.overall === "VERIFIED" ? "SUCCESS" : "PARTIAL",
      newValue: report as unknown as object,
    });
    return ok(report, undefined, `DNS verification ${report.overall}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden" || message.startsWith("Forbidden:")
          ? 403
          : message === "Invalid CSRF token"
            ? 403
            : message.includes("Too many")
              ? 429
              : message === "Domain not found"
                ? 404
                : 400;
    return fail(message, status);
  }
}

export async function GET(request: Request) {
  try {
    await requireSuperAdminActor();
    const domainId = new URL(request.url).searchParams.get("domainId");
    if (!domainId) {
      return fail("domainId query parameter is required", 400);
    }
    const actor = await requireSuperAdminActor();
    await assertApiRateLimit(`verify-get:${actor.sub}`, 60, 60_000);
    const report = await verifyService.verifyById(domainId, actor.sub);
    return ok(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return fail(
      message,
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message === "Domain not found"
            ? 404
            : 400,
    );
  }
}
