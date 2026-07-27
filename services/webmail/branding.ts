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

/** Build HTML signature block with optional domain logo for outgoing mail. */
export function buildOutgoingSignatureHtml(branding: WebmailBranding): string {
  if (branding.signatureHtml?.trim()) return branding.signatureHtml.trim();
  const lines: string[] = [];
  if (branding.domainLogoDataUrl) {
    lines.push(
      `<img src="${branding.domainLogoDataUrl}" alt="" style="max-height:48px;max-width:180px;display:block;margin-bottom:8px" />`,
    );
  }
  lines.push(`<strong>${escapeHtml(branding.displayName)}</strong>`);
  if (branding.jobTitle) lines.push(`<div>${escapeHtml(branding.jobTitle)}</div>`);
  if (branding.company || branding.domainCompanyName) {
    lines.push(`<div>${escapeHtml(branding.company || branding.domainCompanyName || "")}</div>`);
  }
  if (branding.phone) lines.push(`<div>${escapeHtml(branding.phone)}</div>`);
  if (branding.website) {
    const href = branding.website.startsWith("http") ? branding.website : `https://${branding.website}`;
    lines.push(`<div><a href="${escapeHtml(href)}">${escapeHtml(branding.website)}</a></div>`);
  }
  lines.push(`<div><a href="mailto:${escapeHtml(branding.email)}">${escapeHtml(branding.email)}</a></div>`);
  if (branding.signatureText?.trim()) {
    lines.push(`<div style="margin-top:8px;white-space:pre-wrap">${escapeHtml(branding.signatureText.trim())}</div>`);
  }
  return `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e5e5;font-family:system-ui,sans-serif;font-size:13px;color:#333">${lines.join("")}</div>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
