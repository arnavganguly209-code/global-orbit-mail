import { domainRepository } from "@/repositories/domain.repository";
import {
  domainCreateSchema,
  domainUpdateSchema,
  paginationSchema,
} from "@/lib/validations/admin";
import { getDefaultOrganizationId } from "@/repositories";
import { getDomainDnsPayload } from "@/services/dns/engine";
import { normalizeApexDomain, isValidApexDomain } from "@/lib/dns/domain-name";

export const domainService = {
  async list(query: Record<string, string | string[] | undefined>) {
    const parsed = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
    const status = typeof query.status === "string" ? query.status : undefined;
    return domainRepository.list({ ...parsed, status });
  },

  /**
   * Idempotent create:
   * - normalizes www/https/case/spaces → apex
   * - returns existing domain instead of failing on duplicates
   * - generates DNS payload
   */
  async create(body: unknown, actorId?: string | null, organizationId?: string | null) {
    const input = domainCreateSchema.parse(body);
    const apex = normalizeApexDomain(input.name);
    if (!isValidApexDomain(apex)) {
      throw new Error("Invalid domain name.");
    }

    const orgId = organizationId ?? (await getDefaultOrganizationId());
    const result = await domainRepository.createOrGet({
      name: apex,
      organizationId: orgId,
      actorId,
    });

    const dns = await getDomainDnsPayload(result.domain.id);
    return {
      ...result.domain,
      dns,
      alreadyExisted: !result.created && !result.restored,
      restored: result.restored,
      created: result.created,
    };
  },

  async update(id: string, body: unknown, actorId?: string | null) {
    const input = domainUpdateSchema.parse(body);
    const updated = await domainRepository.update(id, input, actorId);
    if (!updated) throw new Error("Domain not found");
    return updated;
  },

  async remove(id: string, actorId?: string | null) {
    const ok = await domainRepository.softDelete(id, actorId);
    if (!ok) throw new Error("Domain not found");
    return true;
  },

  async get(id: string) {
    const domain = await domainRepository.getById(id);
    if (!domain) throw new Error("Domain not found");
    const dns = await getDomainDnsPayload(id);
    return { ...domain, dns };
  },

  async listForOrganization(
    query: Record<string, string | string[] | undefined>,
    organizationId: string,
  ) {
    const parsed = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
    const status = typeof query.status === "string" ? query.status : undefined;
    return domainRepository.list({ ...parsed, status, organizationId });
  },

  async createForOrganization(body: unknown, organizationId: string, actorId?: string | null) {
    return this.create(body, actorId, organizationId);
  },

  async getForOrganization(id: string, organizationId: string) {
    const domain = await domainRepository.getById(id);
    if (!domain || domain.organizationId !== organizationId) {
      throw new Error("Domain not found");
    }
    const dns = await getDomainDnsPayload(id);
    return { ...domain, dns };
  },
};
