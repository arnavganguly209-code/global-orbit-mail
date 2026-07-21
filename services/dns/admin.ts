import { dnsVerificationService } from "@/services/dns/verification";
import { getDomainDnsPayload } from "@/services/dns/engine";
import { domainVerifySchema } from "@/lib/validations/admin";
import { dnsRepository } from "@/repositories";

export const verifyService = {
  async verify(body: unknown, actorId?: string | null) {
    const input = domainVerifySchema.parse(body);
    return dnsVerificationService.verifyDomain(input.domainId, actorId);
  },

  async verifyById(domainId: string, actorId?: string | null) {
    return dnsVerificationService.verifyDomain(domainId, actorId);
  },
};

export const dnsAdminService = {
  async list(domainId?: string) {
    if (domainId) {
      const structured = await getDomainDnsPayload(domainId);
      if (!structured) throw new Error("Domain not found");
      return structured;
    }
    const rows = await dnsRepository.listAll();
    return {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      flat: rows,
    };
  },
};
