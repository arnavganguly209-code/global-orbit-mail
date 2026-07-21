import {
  auditRepository,
  dnsRepository,
  settingsRepository,
  userRepository,
} from "@/repositories";
import {
  auditQuerySchema,
  settingsUpdateSchema,
  userCreateSchema,
} from "@/lib/validations/admin";

export const userService = {
  list(query: Record<string, string | string[] | undefined>) {
    const parsed = auditQuerySchema
      .pick({ page: true, pageSize: true, search: true })
      .parse({
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
      });
    return userRepository.list(parsed);
  },
  create(body: unknown) {
    const input = userCreateSchema.parse(body);
    return userRepository.create(input);
  },
};

export const dnsService = {
  list(domainId?: string) {
    if (domainId) return dnsRepository.listByDomain(domainId);
    return dnsRepository.listAll();
  },
};

export const auditService = {
  list(query: Record<string, string | string[] | undefined>) {
    const parsed = auditQuerySchema.parse({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      action: query.action,
      actor: query.actor,
    });
    return auditRepository.list(parsed);
  },
  exportCsv() {
    const rows = auditRepository.exportAll();
    const header = "id,actorEmail,action,resource,resourceId,ipAddress,createdAt";
    const lines = rows.map((r) =>
      [r.id, r.actorEmail, r.action, r.resource, r.resourceId, r.ipAddress, r.createdAt]
        .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
        .join(","),
    );
    return [header, ...lines].join("\n");
  },
};

export const settingsService = {
  get() {
    return settingsRepository.getAll();
  },
  update(body: unknown) {
    const input = settingsUpdateSchema.parse(body);
    return settingsRepository.update(input.section, input.values);
  },
};
