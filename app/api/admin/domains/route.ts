import { ok, fail, created, parseJson } from "@/lib/api/response";
import { domainService } from "@/services/domains";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    return ok(domainService.list(query));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to list domains", 400);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request);
    return created(domainService.create(body), "Domain created");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to create domain", 400);
  }
}
