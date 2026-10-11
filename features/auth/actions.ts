"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOGIN_PATH, safeRedirectPath } from "@/lib/auth/routes";
import { getAppUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./form-state";
import {
  fieldErrorsOf,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

// Never log form values here: they include passwords and personal data.

async function appOrigin(): Promise<string> {
  const configured = getAppUrl();
  if (configured) return configured;
  // Supabase only sends links to origins on its redirect allow-list, so a spoofed Origin header
  // cannot redirect users to an arbitrary site.
  const origin = (await headers()).get("origin");
  return getAppUrl(origin ?? undefined) ?? "http://localhost:3000";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Confirm your email address first. Check your inbox for the link.",
        email,
      };
    }
    if (error.code === "invalid_credentials") {
      return { status: "error", message: "Incorrect email or password.", email };
    }
    return { status: "error", message: "Sign-in failed. Please try again.", email };
  }

  redirect(safeRedirectPath(formData.get("next")?.toString()));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName") ?? "",
    timezone: formData.get("timezone") ?? undefined,
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), email };
  }

  const { email: address, password, displayName, timezone } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: address,
    password,
    options: {
      emailRedirectTo: `${await appOrigin()}/auth/callback?next=/dashboard`,
      data: { display_name: displayName, timezone },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        fieldErrors: { password: [error.message] },
        email,
      };
    }
    if (error.code === "over_email_send_rate_limit") {
      return {
        status: "error",
        message: "Too many emails were sent recently. Wait a few minutes and try again.",
        email,
      };
    }
    return { status: "error", message: "Could not create the account. Please try again.", email };
  }

  // Deliberately identical whether or not the address already has an account.
  return {
    status: "success",
    message: `Check ${address} for a confirmation link. You can sign in after confirming.`,
  };
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await appOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error?.code === "over_email_send_rate_limit") {
    return {
      status: "error",
      message: "Too many emails were sent recently. Wait a few minutes and try again.",
      email,
    };
  }
  if (error) {
    return { status: "error", message: "Could not send the email. Please try again.", email };
  }

  return {
    status: "success",
    message: `If ${parsed.data.email} has an account, a password reset link is on its way.`,
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return {
      status: "error",
      message: "Your reset link has expired. Request a new one from the sign-in page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return {
        status: "error",
        fieldErrors: { password: ["Choose a password different from your current one."] },
      };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: [error.message] } };
    }
    return { status: "error", message: "Could not update the password. Please try again." };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
