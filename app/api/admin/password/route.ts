import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { passwordService } from "@/services/password";
import { assertApiRateLimit } from "@/lib/api/rate-limit";

/**
 * POST /api/admin/password
 * Generate a secure password; optionally apply to a mailbox (hashed + provisioned).
 * Body: { length?, mailboxId?, apply? }
 */
export async function POST(request: Request) {
  try {
    const actor = await requireAdminMutation(request);
    requirePermission(actor.role, "mailbox:write");
    await assertApiRateLimit(`password:${actor.sub}`, 20, 60_000);
    const body = await parseJson(request);
    const result = await passwordService.generateAndOptionallyApply(body, actor.sub);
    return ok(result, undefined, result.applied ? "Password applied" : "Password generated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password operation failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden" || message.startsWith("Forbidden:")
          ? 403
          : message === "Invalid CSRF token"
            ? 403
            : message.includes("Too many")
              ? 429
              : message === "Mailbox not found"
                ? 404
                : 400;
    return fail(message, status);
  }
}
