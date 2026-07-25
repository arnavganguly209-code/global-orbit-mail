import { ok, fail } from "@/lib/api/response";
import { requireSuperAdminMutation } from "@/lib/api/actor";
import { mailEngine } from "@/services/provisioning/mail-engine";

/**
 * POST /api/admin/system/platform-ensure
 * Idempotent: PHP/Nginx/Postfix/Roundcube attachment limits + IPv4 outbound.
 * Does not change Dovecot auth or Roundcube IMAP/SMTP host settings.
 */
export async function POST(request: Request) {
  try {
    await requireSuperAdminMutation(request);
    if (!mailEngine.isEnabled()) {
      return fail("Mail provisioning is disabled", 400);
    }
    const result = await mailEngine.ensurePlatform();
    if (!result.ok) {
      return fail(result.stderr || "Platform ensure failed", 500);
    }
    return ok(
      {
        platformEnsured: true,
        data: result.data ?? null,
        stdout: result.stdout?.slice(0, 4000) ?? "",
      },
      undefined,
      "Platform limits applied",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Platform ensure failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden") || message === "Invalid CSRF token"
          ? 403
          : 400;
    return fail(message, status);
  }
}
