import { z } from "zod";

export const emailSchema = z.string().email("Enter a valid email address");

export const loginSchema = z.object({
  email: z.string().trim().min(3, "Enter your username or email").max(190),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const adminLoginSchema = loginSchema.extend({
  organizationSlug: z.string().optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: emailSchema,
  company: z.string().trim().min(1, "Enter your company name").max(160),
  password: z.string().min(12, "Password must be at least 12 characters").max(128),
  planKey: z.enum(["starter", "business", "enterprise"]).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
