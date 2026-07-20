import { z } from "zod";

export const emailSchema = z.string().email("Enter a valid email address");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const adminLoginSchema = loginSchema.extend({
  organizationSlug: z.string().optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
