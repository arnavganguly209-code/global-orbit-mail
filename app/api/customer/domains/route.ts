import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireCustomerActor, requireCustomerMutation } from "@/lib/api/actor";
import { domainService } from "@/services/domains";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const actor = await requireCustomerActor();
    const items = await prisma.domain.findMany({
      where: { organizationId: actor.organizationId ?? undefined, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return ok(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCustomerMutation(request);
    const body = await parseJson(request);
    const domain = await domainService.create(body, actor.sub, actor.organizationId);
    const dnsRecords = await prisma.dnsRecord.findMany({
      where: { domainId: domain.id, deletedAt: null },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return created({ ...domain, dnsRecords }, "Domain created");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return fail(
      message,
      message === "Unauthorized" || message === "Forbidden"
        ? 401
        : message === "Invalid CSRF token"
          ? 403
          : 400,
    );
  }
}
