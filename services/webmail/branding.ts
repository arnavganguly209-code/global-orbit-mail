/**
 * Resolve mailbox branding from Prisma for webmail sessions.
 */

import { prisma } from "@/lib/db";

export type WebmailBranding = {
  mailboxId: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  website: string | null;
  company: string | null;
  replyTo: string | null;
  timezone: string | null;
  language: string | null;
  signatureHtml: string | null;
  signatureText: string | null;
  avatarUrl: string | null;
  domainName: string;
  domainCompanyName: string | null;
  domainLogoDataUrl: string | null;
  brandColor: string | null;
  quotaMb: number;
  usedMb: number;
};

export async function getMailboxBrandingByEmail(email: string): Promise<WebmailBranding | null> {
  const normalized = email.toLowerCase().trim();
  const at = normalized.lastIndexOf("@");
  if (at < 1) return null;
  const localPart = normalized.slice(0, at);
  const domainName = normalized.slice(at + 1);

  const mailbox = await prisma.mailbox.findFirst({
    where: {
      deletedAt: null,
      localPart: { equals: localPart, mode: "insensitive" },
      domain: { name: { equals: domainName, mode: "insensitive" }, deletedAt: null },
    },
    include: {
      domain: true,
      quota: true,
    },
  });
  if (!mailbox) return null;

  return {
    mailboxId: mailbox.id,
    email: `${mailbox.localPart}@${mailbox.domain.name}`,
    displayName: mailbox.displayName || mailbox.localPart,
    jobTitle: mailbox.jobTitle,
    department: mailbox.department,
    phone: mailbox.phone,
    website: mailbox.website,
    company: mailbox.company || mailbox.domain.companyName,
    replyTo: mailbox.replyTo,
    timezone: mailbox.timezone,
    language: mailbox.language,
    signatureHtml: mailbox.signatureHtml,
    signatureText: mailbox.signatureText,
    avatarUrl: mailbox.avatarUrl,
    domainName: mailbox.domain.name,
    domainCompanyName: mailbox.domain.companyName,
    domainLogoDataUrl: mailbox.domain.logoDataUrl,
    brandColor: mailbox.domain.brandColor,
    quotaMb: mailbox.quota?.quotaMb ?? 2048,
    usedMb: mailbox.quota?.usedMb ?? 0,
  };
}

export async function touchMailboxLastLogin(email: string) {
  const branding = await getMailboxBrandingByEmail(email);
  if (!branding) return;
  await prisma.mailbox.update({
    where: { id: branding.mailboxId },
    data: { lastLoginAt: new Date() },
  });
}

export async function updateMailboxProfileByEmail(
  email: string,
  patch: {
    displayName?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    phone?: string | null;
    website?: string | null;
    company?: string | null;
    replyTo?: string | null;
    timezone?: string | null;
    language?: string | null;
    signatureHtml?: string | null;
    signatureText?: string | null;
    avatarUrl?: string | null;
  },
) {
  const branding = await getMailboxBrandingByEmail(email);
  if (!branding) throw Object.assign(new Error("Mailbox profile not found"), { status: 404 });
  await prisma.mailbox.update({
    where: { id: branding.mailboxId },
    data: {
      displayName: patch.displayName === undefined ? undefined : patch.displayName,
      jobTitle: patch.jobTitle === undefined ? undefined : patch.jobTitle,
      department: patch.department === undefined ? undefined : patch.department,
      phone: patch.phone === undefined ? undefined : patch.phone,
      website: patch.website === undefined ? undefined : patch.website,
      company: patch.company === undefined ? undefined : patch.company,
      replyTo: patch.replyTo === undefined ? undefined : patch.replyTo === "" ? null : patch.replyTo,
      timezone: patch.timezone === undefined ? undefined : patch.timezone,
      language: patch.language === undefined ? undefined : patch.language,
      signatureHtml: patch.signatureHtml === undefined ? undefined : patch.signatureHtml,
      signatureText: patch.signatureText === undefined ? undefined : patch.signatureText,
      avatarUrl: patch.avatarUrl === undefined ? undefined : patch.avatarUrl,
    },
  });
  return getMailboxBrandingByEmail(email);
}

/** Prefer mailbox upload (avatar), then domain company logo. */
export function resolveSignatureLogo(branding: WebmailBranding): string | null {
  const logo = branding.avatarUrl?.trim() || branding.domainLogoDataUrl?.trim() || "";
  return logo || null;
}

/** Build HTML signature block with optional company logo for outgoing mail. */
export function buildOutgoingSignatureHtml(
  branding: WebmailBranding,
  opts?: { logoSrc?: string | null },
): string {
  const logoUrl = opts?.logoSrc !== undefined ? opts.logoSrc : resolveSignatureLogo(branding);
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="" style="max-height:56px;max-width:200px;display:block;margin-bottom:10px" />`
    : "";

  if (branding.signatureHtml?.trim()) {
    const custom = branding.signatureHtml.trim();
    if (logo && !/<img[\s>]/i.test(custom)) {
      return `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e5e5;font-family:system-ui,sans-serif;font-size:13px;color:#333">${logo}${custom}</div>`;
    }
    return custom;
  }

  if (branding.signatureText?.trim()) {
    return `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e5e5;font-family:system-ui,sans-serif;font-size:13px;line-height:1.45;color:#333">${logo}<div style="white-space:pre-wrap;color:#666">${escapeHtml(branding.signatureText.trim())}</div></div>`;
  }

  // Default: company logo only — do not auto-append display name / email.
  if (logo) {
    return `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e5e5">${logo}</div>`;
  }
  return "";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
