import { ok, fail, created, parseJson } from "@/lib/api/response";
import { mailboxService } from "@/services/mailboxes";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    return ok(mailboxService.list(query));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to list mailboxes", 400);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request);
    return created(mailboxService.create(body), "Mailbox created");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to create mailbox", 400);
  }
}
