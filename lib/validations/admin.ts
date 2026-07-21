import { z } from "zod";
import { isValidApexDomain, normalizeApexDomain } from "@/lib/dns/domain-name";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(""),
});

export const domainCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Invalid domain name.")
    .max(253, "Invalid domain name.")
    .transform((value) => normalizeApexDomain(value))
    .refine((value) => isValidApexDomain(value), { message: "Invalid domain name." }),
});

export const domainUpdateSchema = z.object({
  status: z.enum(["PENDING", "VERIFYING", "ACTIVE", "SUSPENDED", "FAILED"]).optional(),
  sslStatus: z.enum(["NONE", "PENDING", "ACTIVE", "EXPIRED", "FAILED"]).optional(),
  dnsStatus: z.enum(["UNKNOWN", "PENDING", "PARTIAL", "VERIFIED", "FAILED"]).optional(),
  mailStatus: z
    .enum(["DISABLED", "PROVISIONING", "ACTIVE", "SUSPENDED", "ERROR"])
    .optional(),
});

export const mailboxCreateSchema = z.object({
  localPart: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9._+-]+$/i, "Invalid local part"),
  domainId: z.string().min(1),
  displayName: z.string().trim().max(120).optional(),
  quotaMb: z.coerce.number().int().min(100).max(102400).default(2048),
  password: z.string().min(12).max(128),
});

export const mailboxUpdateSchema = z.object({
  displayName: z.string().trim().max(120).nullable().optional(),
  quotaMb: z.coerce.number().int().min(100).max(102400).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED", "PENDING"]).optional(),
  vacationEnabled: z.boolean().optional(),
  vacationSubject: z.string().trim().max(200).nullable().optional(),
  vacationBody: z.string().trim().max(10000).nullable().optional(),
  vacationExpiresAt: z.string().datetime().nullable().optional(),
});

export const mailboxPasswordSchema = z
  .object({
    password: z.string().min(12).max(128).optional(),
    generate: z.boolean().optional(),
    length: z.coerce.number().int().min(12).max(64).optional(),
  })
  .refine((v) => Boolean(v.password) || v.generate === true, {
    message: "Provide password or set generate=true",
  });

export const domainVerifySchema = z.object({
  domainId: z.string().uuid(),
});

export const passwordGenerateSchema = z.object({
  mailboxId: z.string().uuid().optional(),
  length: z.coerce.number().int().min(12).max(64).default(20),
  apply: z.boolean().default(false),
});

export const storageQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  mailboxId: z.string().uuid().optional(),
  sync: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export const aliasCreateSchema = z.object({
  address: z.string().trim().email().max(254),
});

export const forwarderCreateSchema = z.object({
  destination: z.string().trim().email().max(254),
  keepCopy: z.boolean().default(true),
});

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["SUPER_ADMIN", "RESELLER", "CUSTOMER", "SUPPORT_STAFF", "MAILBOX_USER"]),
});

export const settingsUpdateSchema = z.object({
  section: z.enum(["company", "brand", "smtp", "imap", "security", "appearance"]),
  values: z.record(z.string(), z.unknown()),
});

export const auditQuerySchema = paginationSchema.extend({
  action: z.string().optional(),
  actor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
