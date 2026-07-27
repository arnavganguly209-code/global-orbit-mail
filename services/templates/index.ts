/**
 * Email templates — CRUD + render with variable substitution.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { EmailTemplateCategory } from "@prisma/client";

const templateSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_.-]+$/i),
  name: z.string().min(1),
  category: z.enum(["SYSTEM", "BILLING", "WELCOME", "SECURITY", "QUOTA", "CUSTOM"]).default("CUSTOM"),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  variables: z.array(z.string()).optional(),
  active: z.boolean().default(true),
});

function substitute(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export const templateService = {
  async list() {
    return prisma.emailTemplate.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  },

  async getByKey(key: string) {
    const row = await prisma.emailTemplate.findUnique({ where: { key } });
    if (!row) throw new Error("Template not found");
    return row;
  },

  async create(body: unknown, actorId: string) {
    const input = templateSchema.parse(body);
    const row = await prisma.emailTemplate.create({
      data: {
        ...input,
        category: input.category as EmailTemplateCategory,
        variables: input.variables ?? [],
      },
    });
    await writeAudit({ actorId, action: "template.create", resource: "email_template", resourceId: row.id });
    return row;
  },

  async update(id: string, body: unknown, actorId: string) {
    const input = templateSchema.partial().parse(body);
    const row = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...input,
        category: input.category as EmailTemplateCategory | undefined,
        variables: input.variables,
      },
    });
    await writeAudit({ actorId, action: "template.update", resource: "email_template", resourceId: id });
    return row;
  },

  async remove(id: string, actorId: string) {
    await prisma.emailTemplate.delete({ where: { id } });
    await writeAudit({ actorId, action: "template.delete", resource: "email_template", resourceId: id });
    return { ok: true };
  },

  render(template: { subject: string; htmlBody: string; textBody: string | null }, vars: Record<string, string>) {
    return {
      subject: substitute(template.subject, vars),
      html: substitute(template.htmlBody, vars),
      text: template.textBody ? substitute(template.textBody, vars) : undefined,
    };
  },

  async preview(key: string, vars: Record<string, string>) {
    const tpl = await this.getByKey(key);
    return this.render(tpl, vars);
  },

  async ensureDefaults() {
    const defaults = [
      {
        key: "welcome.mailbox",
        name: "Welcome — New Mailbox",
        category: "WELCOME" as const,
        subject: "Welcome to {{companyName}} mail",
        htmlBody:
          "<p>Hello {{displayName}},</p><p>Your mailbox <strong>{{email}}</strong> is ready.</p><p>Sign in at {{webmailUrl}}</p>",
        textBody: "Hello {{displayName}},\n\nYour mailbox {{email}} is ready.\n\nSign in at {{webmailUrl}}",
        variables: ["displayName", "email", "companyName", "webmailUrl"],
      },
      {
        key: "billing.invoice_paid",
        name: "Invoice Paid",
        category: "BILLING" as const,
        subject: "Payment received — {{invoiceNumber}}",
        htmlBody: "<p>Thank you. We received {{amountUsd}} for invoice {{invoiceNumber}}.</p>",
        textBody: "Thank you. We received {{amountUsd}} for invoice {{invoiceNumber}}.",
        variables: ["invoiceNumber", "amountUsd"],
      },
      {
        key: "security.password_reset",
        name: "Password Reset Notice",
        category: "SECURITY" as const,
        subject: "Your mailbox password was reset",
        htmlBody: "<p>The password for {{email}} was reset by an administrator.</p>",
        textBody: "The password for {{email}} was reset by an administrator.",
        variables: ["email"],
      },
    ];

    for (const d of defaults) {
      await prisma.emailTemplate.upsert({
        where: { key: d.key },
        create: { ...d, variables: d.variables },
        update: {},
      });
    }
  },
};
