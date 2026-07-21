import { prisma } from "@/lib/db";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import {
  aliasCreateSchema,
  forwarderCreateSchema,
  mailboxCreateSchema,
  mailboxPasswordSchema,
  mailboxUpdateSchema,
  paginationSchema,
} from "@/lib/validations/admin";
import { generateSecurePassword } from "@/services/provisioning/password";

export const mailboxService = {
  async list(query: Record<string, string | string[] | undefined>) {
    const parsed = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
    return mailboxRepository.list(parsed);
  },

  async create(body: unknown, actorId?: string | null) {
    const input = mailboxCreateSchema.parse(body);
    const mailbox = await mailboxRepository.create({
      localPart: input.localPart,
      domainId: input.domainId,
      displayName: input.displayName,
      quotaMb: input.quotaMb,
      password: input.password,
      actorId,
    });
    if (!mailbox) throw new Error("Domain not found");
    return mailbox;
  },

  async update(id: string, body: unknown, actorId?: string | null) {
    const input = mailboxUpdateSchema.parse(body);
    const updated = await mailboxRepository.update(
      id,
      {
        ...input,
        vacationExpiresAt:
          input.vacationExpiresAt === undefined
            ? undefined
            : input.vacationExpiresAt === null
              ? null
              : new Date(input.vacationExpiresAt),
      },
      actorId,
    );
    if (!updated) throw new Error("Mailbox not found");
    return updated;
  },

  async suspend(id: string, actorId?: string | null) {
    const updated = await mailboxRepository.setStatus(id, "SUSPENDED", actorId);
    if (!updated) throw new Error("Mailbox not found");
    return updated;
  },

  async activate(id: string, actorId?: string | null) {
    const updated = await mailboxRepository.setStatus(id, "ACTIVE", actorId);
    if (!updated) throw new Error("Mailbox not found");
    return updated;
  },

  async resetPassword(id: string, body: unknown, actorId?: string | null) {
    const input = mailboxPasswordSchema.parse(body);
    const generated = input.generate === true || !input.password;
    const password = generated
      ? generateSecurePassword(input.length ?? 20)
      : (input.password as string);
    const mailbox = await mailboxRepository.resetPassword(id, password, actorId);
    if (!mailbox) throw new Error("Mailbox not found");
    return {
      id: mailbox.id,
      reset: true,
      generated,
      password: generated ? password : undefined,
    };
  },

  async remove(id: string, actorId?: string | null) {
    const ok = await mailboxRepository.softDelete(id, actorId);
    if (!ok) throw new Error("Mailbox not found");
    return true;
  },

  async listAliases(mailboxId: string) {
    return mailboxRepository.listAliases(mailboxId);
  },

  async addAlias(mailboxId: string, body: unknown, actorId?: string | null) {
    const input = aliasCreateSchema.parse(body);
    const alias = await mailboxRepository.addAlias(mailboxId, input.address, actorId);
    if (!alias) throw new Error("Mailbox not found");
    return alias;
  },

  async removeAlias(mailboxId: string, aliasId: string, actorId?: string | null) {
    const ok = await mailboxRepository.removeAlias(mailboxId, aliasId, actorId);
    if (!ok) throw new Error("Alias not found");
    return true;
  },

  async listForwarders(mailboxId: string) {
    return mailboxRepository.listForwarders(mailboxId);
  },

  async addForwarder(mailboxId: string, body: unknown, actorId?: string | null) {
    const input = forwarderCreateSchema.parse(body);
    const forwarder = await mailboxRepository.addForwarder(
      mailboxId,
      input.destination,
      input.keepCopy,
      actorId,
    );
    if (!forwarder) throw new Error("Mailbox not found");
    return forwarder;
  },

  async removeForwarder(mailboxId: string, forwarderId: string, actorId?: string | null) {
    const ok = await mailboxRepository.removeForwarder(mailboxId, forwarderId, actorId);
    if (!ok) throw new Error("Forwarder not found");
    return true;
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
    return mailboxRepository.list({ ...parsed, organizationId });
  },

  async createForOrganization(body: unknown, organizationId: string, actorId?: string | null) {
    const input = mailboxCreateSchema.parse(body);
    const domain = await prisma.domain.findFirst({
      where: { id: input.domainId, organizationId, deletedAt: null },
    });
    if (!domain) throw new Error("Domain not found");

    const mailbox = await mailboxRepository.create({
      localPart: input.localPart,
      domainId: input.domainId,
      displayName: input.displayName,
      quotaMb: input.quotaMb,
      password: input.password,
      actorId,
    });
    if (!mailbox) throw new Error("Domain not found");
    return mailbox;
  },
};
