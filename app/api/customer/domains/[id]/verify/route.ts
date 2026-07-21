import { ok, fail, parseJson } from "@/lib/api/response";
import { requireCustomerActor, requireCustomerMutation } from "@/lib/api/actor";
import { dnsVerificationService } from "@/services/dns/verification";
import { domainService } from "@/services/domains";
import { domainVerifySchema } from "@/lib/validations/admin";
import { assertApiRateLimit } from "@/lib/api/rate-limit";
import { requestAuditContext, writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/customer/domains/[id]/verify
 * Customer-owned domain DNS verification (auto-poll friendly).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireCustomerMutation(request);
    await assertApiRateLimit(`customer-verify:${actor.sub}`, 40, 60_000);
    const { id } = await params;
    await domainService.getForOrganization(id, actor.organizationId!);

    const body = (await parseJson<Record<string, unknown>>(request).catch(
      () => ({}) as Record<string, unknown>,
    )) as Record<string, unknown>;
    const input = domainVerifySchema.parse({ domainId: body.domainId ?? id });
    if (input.domainId !== id) {
      return fail("Domain mismatch", 400);
    }

    const ctx = requestAuditContext(request);
    const report = await dnsVerificationService.verifyDomain(input.domainId, actor.sub);
    await writeAudit({
      actorId: actor.sub,
      action: "dns.verify",
      resource: "domain",
      resourceId: report.domainId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      status: report.ready ? "SUCCESS" : "PARTIAL",
      newValue: report as unknown as object,
    });

    return ok(
      report,
      undefined,
      report.ready
        ? "Domain is ready."
        : "DNS is propagating. We will keep checking automatically.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden" || message === "Invalid CSRF token"
          ? 403
          : message.includes("Too many")
            ? 429
            : message === "Domain not found"
              ? 404
              : 400;
    return fail(
      message.includes("prisma") || message.includes("Unique")
        ? "Unable to verify DNS right now. Please try again shortly."
        : message,
      status,
    );
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const actor = await requireCustomerActor();
    await assertApiRateLimit(`customer-verify-get:${actor.sub}`, 60, 60_000);
    const { id } = await params;
    await domainService.getForOrganization(id, actor.organizationId!);
    const report = await dnsVerificationService.verifyDomain(id, actor.sub);
    return ok(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return fail(
      message,
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : message === "Domain not found"
            ? 404
            : 400,
    );
  }
}
