import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { userService } from "@/services/admin";

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    return ok(await userService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Users list failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminActor();
    const body = await parseJson(request);
    return created(await userService.create(body, actor.sub), "User invited");
  } catch (error) {
    const message = error instanceof Error ? error.message : "User create failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
