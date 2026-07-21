import { ok, fail, parseJson } from "@/lib/api/response";
import { mailboxService } from "@/services/mailboxes";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseJson(request);
    return ok(mailboxService.resetPassword(id, body), undefined, "Password reset queued");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Reset failed", 400);
  }
}
