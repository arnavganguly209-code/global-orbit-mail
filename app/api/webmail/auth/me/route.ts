import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import { getMailboxBrandingByEmail } from "@/services/webmail/branding";

export const runtime = "nodejs";

export async function GET() {
  try {
    const creds = await requireWebmailCredentials();
    const branding = await getMailboxBrandingByEmail(creds.email);
    const local = creds.email.split("@")[0] || creds.email;
    return ok({
      email: creds.email,
      name: branding?.displayName || local,
      online: true,
      branding: branding
        ? {
            displayName: branding.displayName,
            jobTitle: branding.jobTitle,
            company: branding.company,
            phone: branding.phone,
            website: branding.website,
            signatureHtml: branding.signatureHtml,
            signatureText: branding.signatureText,
            avatarUrl: branding.avatarUrl,
            domainLogoDataUrl: branding.domainLogoDataUrl,
            domainCompanyName: branding.domainCompanyName,
            brandColor: branding.brandColor,
            quotaMb: branding.quotaMb,
            usedMb: branding.usedMb,
            replyTo: branding.replyTo,
            timezone: branding.timezone,
            language: branding.language,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
