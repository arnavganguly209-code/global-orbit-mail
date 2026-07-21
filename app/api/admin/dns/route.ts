import { ok, fail } from "@/lib/api/response";
import { dnsService } from "@/services/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domainId") ?? undefined;
    return ok(dnsService.list(domainId));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "DNS list failed", 400);
  }
}
