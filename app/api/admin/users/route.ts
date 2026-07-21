import { ok, fail, created, parseJson } from "@/lib/api/response";
import { userService } from "@/services/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return ok(userService.list(Object.fromEntries(searchParams.entries())));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Users list failed", 400);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request);
    return created(userService.create(body), "User invited");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "User create failed", 400);
  }
}
