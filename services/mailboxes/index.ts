import { mailboxRepository } from "@/repositories/mailbox.repository";
import {
  mailboxCreateSchema,
  mailboxPasswordSchema,
  mailboxUpdateSchema,
  paginationSchema,
} from "@/lib/validations/admin";

export const mailboxService = {
  list(query: Record<string, string | string[] | undefined>) {
    const parsed = paginationSchema.parse({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
    return mailboxRepository.list(parsed);
  },

  create(body: unknown) {
    const input = mailboxCreateSchema.parse(body);
    // password accepted & validated; VPS provisioning deferred
    void input.password;
    const mailbox = mailboxRepository.create({
      localPart: input.localPart,
      domainId: input.domainId,
      displayName: input.displayName,
      quotaMb: input.quotaMb,
    });
    if (!mailbox) throw new Error("Domain not found");
    return mailbox;
  },

  update(id: string, body: unknown) {
    const input = mailboxUpdateSchema.parse(body);
    const updated = mailboxRepository.update(id, input);
    if (!updated) throw new Error("Mailbox not found");
    return updated;
  },

  resetPassword(id: string, body: unknown) {
    mailboxPasswordSchema.parse(body);
    const mailbox = mailboxRepository.resetPassword(id);
    if (!mailbox) throw new Error("Mailbox not found");
    return { id: mailbox.id, reset: true };
  },

  remove(id: string) {
    const ok = mailboxRepository.remove(id);
    if (!ok) throw new Error("Mailbox not found");
    return true;
  },
};
