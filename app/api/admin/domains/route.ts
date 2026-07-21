import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { domainService } from "@/services/domains";

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    return ok(await domainService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list domains";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActor();
    const body = await parseJson(request);
    return created(await domainService.create(body, actor.sub), "Domain created");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create domain";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
