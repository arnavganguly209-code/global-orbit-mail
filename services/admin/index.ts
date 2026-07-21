import {
  auditRepository,
  getDefaultOrganizationId,
  settingsRepository,
  userRepository,
} from "@/repositories";
import {
  auditQuerySchema,
  settingsUpdateSchema,
  userCreateSchema,
} from "@/lib/validations/admin";

export const userService = {
  async list(query: Record<string, string | string[] | undefined>) {
    const parsed = auditQuerySchema
      .pick({ page: true, pageSize: true, search: true })
      .parse({
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
      });
    return userRepository.list(parsed);
  },
  async create(body: unknown, actorId?: string | null) {
    const input = userCreateSchema.parse(body);
    const organizationId = await getDefaultOrganizationId();
    return userRepository.create({ ...input, organizationId, actorId });
  },
};

export const dnsService = {
  async list(domainId?: string) {
    const { dnsAdminService } = await import("@/services/dns/admin");
    return dnsAdminService.list(domainId);
  },
};

export const auditService = {
  async list(query: Record<string, string | string[] | undefined>) {
    const parsed = auditQuerySchema.parse({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      action: query.action,
      actor: query.actor,
    });
    return auditRepository.list(parsed);
  },
  async exportCsv() {
    const rows = await auditRepository.exportAll();
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
  async get() {
    const organizationId = await getDefaultOrganizationId();
    return settingsRepository.getAll(organizationId);
  },
  async update(body: unknown, actorId?: string | null) {
    const input = settingsUpdateSchema.parse(body);
    const organizationId = await getDefaultOrganizationId();
    return settingsRepository.update(organizationId, input.section, input.values, actorId);
  },
};
