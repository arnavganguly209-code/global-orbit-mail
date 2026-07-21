import { domainRepository } from "@/repositories/domain.repository";
import {
  domainCreateSchema,
  domainUpdateSchema,
  paginationSchema,
} from "@/lib/validations/admin";
import { getDefaultOrganizationId } from "@/repositories";

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

  async create(body: unknown, actorId?: string | null) {
    const input = domainCreateSchema.parse(body);
    const existing = await domainRepository.getByName(input.name);
    if (existing) throw new Error("Domain already exists");
    const organizationId = await getDefaultOrganizationId();
    return domainRepository.create({
      name: input.name,
      organizationId,
      actorId,
    });
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
    return domain;
  },
};
