/**
 * DNS Verification Service — architecture only.
 * Future: real MX/TXT/DKIM/DMARC lookups. No network DNS execution in Phase 2B.
 */

import { prisma } from "@/lib/db";
import type { DnsRecordStatus, VerificationState } from "@prisma/client";

export type DnsLookupKind = "MX" | "TXT" | "DKIM" | "DMARC";

export interface DnsLookupResult {
  kind: DnsLookupKind;
  host: string;
  records: string[];
  ok: boolean;
  detail: string;
}

export const dnsVerificationService = {
  /**
   * Reserved for live resolver integration (dig/dns.promises).
   */
  async lookup(_kind: DnsLookupKind, _host: string): Promise<DnsLookupResult> {
    return {
      kind: _kind,
      host: _host,
      records: [],
      ok: false,
      detail: "Live DNS lookup deferred — architecture stub",
    };
  },

  async markRecordStatus(recordId: string, status: DnsRecordStatus) {
    return prisma.dnsRecord.update({
      where: { id: recordId },
      data: { status },
    });
  },

  async markVerification(domainId: string, state: VerificationState) {
    await prisma.verification.updateMany({
      where: { domainId },
      data: { state, checkedAt: new Date() },
    });

    const dnsStatus =
      state === "VERIFIED" ? "VERIFIED" : state === "FAILED" ? "FAILED" : "PENDING";

    return prisma.domain.update({
      where: { id: domainId },
      data: {
        dnsStatus,
        verifiedAt: state === "VERIFIED" ? new Date() : null,
      },
    });
  },

  async evaluateDomain(domainId: string) {
    const records = await prisma.dnsRecord.findMany({
      where: { domainId, deletedAt: null },
    });
    const verified = records.filter((r) => r.status === "VERIFIED").length;
    const missing = records.filter((r) => r.status === "MISSING").length;
    if (records.length > 0 && verified === records.length) {
      return this.markVerification(domainId, "VERIFIED");
    }
    if (missing > 0) {
      return this.markVerification(domainId, "FAILED");
    }
    return this.markVerification(domainId, "PENDING");
  },
};
