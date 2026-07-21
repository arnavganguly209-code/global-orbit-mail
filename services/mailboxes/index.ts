import { mailboxRepository } from "@/repositories/mailbox.repository";
import {
  aliasCreateSchema,
  forwarderCreateSchema,
  mailboxCreateSchema,
  mailboxPasswordSchema,
  mailboxUpdateSchema,
  paginationSchema,
} from "@/lib/validations/admin";

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
    const updated = await mailboxRepository.update(id, input, actorId);
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
    const mailbox = await mailboxRepository.resetPassword(id, input.password, actorId);
    if (!mailbox) throw new Error("Mailbox not found");
    return { id: mailbox.id, reset: true };
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
};
