import { domainRepository } from "@/repositories/domain.repository";
import { domainCreateSchema, domainUpdateSchema, paginationSchema } from "@/lib/validations/admin";

export const domainService = {
  list(query: Record<string, string | string[] | undefined>) {
    const parsed = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
    const status = typeof query.status === "string" ? query.status : undefined;
    return domainRepository.list({ ...parsed, status });
  },

  create(body: unknown) {
    const input = domainCreateSchema.parse(body);
    if (domainRepository.getByName(input.name)) {
      throw new Error("Domain already exists");
    }
    return domainRepository.create(input.name);
  },

  update(id: string, body: unknown) {
    const input = domainUpdateSchema.parse(body);
    const updated = domainRepository.update(id, input);
    if (!updated) throw new Error("Domain not found");
    return updated;
  },

  remove(id: string) {
    const ok = domainRepository.remove(id);
    if (!ok) throw new Error("Domain not found");
    return true;
  },

  get(id: string) {
    const domain = domainRepository.getById(id);
    if (!domain) throw new Error("Domain not found");
    return domain;
  },
};
