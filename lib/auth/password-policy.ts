import { z } from "zod";

/** Shared customer / mailbox password policy used at signup and password change. */
export const NEW_PASSWORD_MIN = 12;
export const NEW_PASSWORD_MAX = 128;

export const newPasswordSchema = z
  .string()
  .min(NEW_PASSWORD_MIN, `Password must be at least ${NEW_PASSWORD_MIN} characters`)
  .max(NEW_PASSWORD_MAX)
  .refine((p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p), {
    message: "Password must include upper, lower, and a number",
  });

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(256),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password").max(256),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
    if (value.currentPassword === value.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must be different from your current password",
      });
    }
  });

export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;

export const CURRENT_PASSWORD_INCORRECT = "Current password is incorrect.";

export function firstZodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
