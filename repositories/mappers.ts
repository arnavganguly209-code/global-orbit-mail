import type {
  AdminDomain,
  AdminMailbox,
  AdminUser,
  AuditLogEntry,
  DnsRecordView,
  SystemRole,
  VerificationTone,
} from "@/types";
import type {
  DnsRecord,
  DnsRecordStatus,
  Domain,
  Mailbox,
  MailboxQuota,
  User,
  Role,
  AuditLog,
} from "@prisma/client";

export function mapDomain(
  domain: Domain & { _count?: { mailboxes: number } },
): AdminDomain {
  return {
    id: domain.id,
    name: domain.name,
    status: domain.status,
    sslStatus: domain.sslStatus,
    dnsStatus: domain.dnsStatus,
    mailStatus: domain.mailStatus,
    organizationId: domain.organizationId,
    mailboxCount: domain._count?.mailboxes ?? 0,
    companyName: domain.companyName ?? null,
    brandColor: domain.brandColor ?? null,
    logoDataUrl: domain.logoDataUrl ?? null,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}

export function mapMailbox(
  mailbox: Mailbox & {
    domain: { name: string; logoDataUrl?: string | null; companyName?: string | null };
    quota: MailboxQuota | null;
    _count?: { aliases: number; forwarders: number };
  },
): AdminMailbox {
  const quotaMb = mailbox.quota?.quotaMb ?? 2048;
  const usedMb = mailbox.quota?.usedMb ?? 0;
  const remainingMb = Math.max(0, quotaMb - usedMb);
  const usagePercent =
    quotaMb > 0 ? Number(Math.min(100, (usedMb / quotaMb) * 100).toFixed(1)) : 0;
  return {
    id: mailbox.id,
    email: `${mailbox.localPart}@${mailbox.domain.name}`,
    localPart: mailbox.localPart,
    domainId: mailbox.domainId,
    domainName: mailbox.domain.name,
    displayName: mailbox.displayName,
    jobTitle: mailbox.jobTitle ?? null,
    department: mailbox.department ?? null,
    phone: mailbox.phone ?? null,
    website: mailbox.website ?? null,
    company: mailbox.company ?? null,
    replyTo: mailbox.replyTo ?? null,
    timezone: mailbox.timezone ?? null,
    language: mailbox.language ?? null,
    signatureHtml: mailbox.signatureHtml ?? null,
    signatureText: mailbox.signatureText ?? null,
    avatarUrl: mailbox.avatarUrl ?? null,
    domainLogoDataUrl: mailbox.domain.logoDataUrl ?? null,
    domainCompanyName: mailbox.domain.companyName ?? null,
    quotaMb,
    usedMb,
    remainingMb,
    usagePercent,
    status: mailbox.status,
    aliasCount: mailbox._count?.aliases ?? 0,
    forwarderCount: mailbox._count?.forwarders ?? 0,
    lastLoginAt: mailbox.lastLoginAt?.toISOString() ?? null,
    createdAt: mailbox.createdAt.toISOString(),
  };
}

export function mapUser(user: User & { role: Role | null }): AdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: (user.role?.key ?? "MAILBOX_USER") as SystemRole,
    status: user.status,
    organizationId: user.organizationId,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

function toneFromDnsStatus(status: DnsRecordStatus): VerificationTone {
  if (status === "VERIFIED" || status === "DETECTED") return "success";
  if (status === "MISSING" || status === "MISMATCH") return "danger";
  return "warning";
}

export function mapDnsRecord(record: DnsRecord): DnsRecordView {
  return {
    id: record.id,
    domainId: record.domainId,
    type: record.type as DnsRecordView["type"],
    name: record.name,
    value: record.value,
    priority: record.priority,
    status: record.status as DnsRecordView["status"],
    tone: toneFromDnsStatus(record.status),
  };
}

export function mapAudit(
  log: AuditLog & { actor: { email: string } | null },
): AuditLogEntry {
  return {
    id: log.id,
    actorEmail: log.actor?.email ?? null,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt.toISOString(),
  };
}
