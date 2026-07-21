import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { verifyService } from "@/services/dns/admin";
import { assertApiRateLimit } from "@/lib/api/rate-limit";

/**
 * POST /api/admin/verify
 * Body: { domainId: uuid }
 * Live MX/SPF/DKIM/DMARC/SSL verification.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireAdminMutation(request);
    requirePermission(actor.role, "dns:write");
    await assertApiRateLimit(`verify:${actor.sub}`, 30, 60_000);
    const body = await parseJson(request);
    const report = await verifyService.verify(body, actor.sub);
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

/**
 * GET /api/admin/verify?domainId=
 * Convenience read of last verification by running a fresh check when domainId set.
 */
export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "dns:read");
    const domainId = new URL(request.url).searchParams.get("domainId");
    if (!domainId) {
      return fail("domainId query parameter is required", 400);
    }
    await assertApiRateLimit(`verify-get:${actor.sub}`, 60, 60_000);
    const report = await verifyService.verifyById(domainId, actor.sub);
    return ok(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return fail(
      message,
      message === "Unauthorized" ? 401 : message === "Domain not found" ? 404 : 400,
    );
  }
}
