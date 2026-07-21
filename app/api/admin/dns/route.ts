import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { dnsService } from "@/services/admin";

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domainId") ?? undefined;
    return ok(await dnsService.list(domainId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "DNS list failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
