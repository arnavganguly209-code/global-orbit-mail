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

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(120),
    company: z.string().trim().min(1, "Enter your company name").max(160),
    country: z.string().trim().min(2, "Select your country").max(80),
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number")
      .max(32)
      .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number"),
    password: z.string().min(12, "Password must be at least 12 characters").max(128),
    confirmPassword: z.string().min(12, "Confirm your password"),
    businessName: z.string().trim().min(1, "Enter your business name").max(160),
    businessType: z.string().trim().min(1, "Select business type").max(80),
    planKey: z.enum(["starter", "business", "enterprise"]).optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const planSelectionSchema = z.object({
  planKey: z.enum(["starter", "business"]),
  interval: z.enum(["MONTHLY", "YEARLY", "TWO_YEAR"]),
});

export type PlanSelectionInput = z.infer<typeof planSelectionSchema>;
