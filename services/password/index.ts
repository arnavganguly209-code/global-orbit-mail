import { generateSecurePassword } from "@/services/provisioning/password";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import { passwordGenerateSchema } from "@/lib/validations/admin";

export const passwordService = {
  async generateAndOptionallyApply(body: unknown, actorId?: string | null) {
    const input = passwordGenerateSchema.parse(body);
    const password = generateSecurePassword(input.length);

    if (input.apply) {
      if (!input.mailboxId) {
        throw new Error("mailboxId is required when apply=true");
      }
      const mailbox = await mailboxRepository.resetPassword(input.mailboxId, password, actorId);
      if (!mailbox) throw new Error("Mailbox not found");
      return {
        generated: true,
        applied: true,
        mailboxId: mailbox.id,
        password,
      };
    }

    return {
      generated: true,
      applied: false,
      mailboxId: input.mailboxId ?? null,
      password,
    };
  },
};
