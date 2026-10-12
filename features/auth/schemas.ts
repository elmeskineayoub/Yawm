import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .pipe(z.email("Enter a valid email address."));

// Supabase Auth hashes with bcrypt, which ignores bytes beyond 72.
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Use at most 72 bytes.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  email,
  password: newPassword,
  displayName: z
    .string()
    .trim()
    .max(100, "Use at most 100 characters.")
    .transform((value) => value || undefined),
  // Detected in the browser. The database validates it again and falls back to UTC.
  timezone: z.string().trim().max(64).optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type FieldErrors = Partial<Record<string, string[]>>;

export { fieldErrorsOf } from "@/lib/form";
