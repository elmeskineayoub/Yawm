"use client";

import { useActionState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { signUp } from "@/features/auth/actions";
import { initialFormState } from "@/features/auth/form-state";

const subscribe = () => () => {};
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialFormState);
  const timezone = useSyncExternalStore(subscribe, browserTimezone, () => "");
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="timezone" value={timezone} />
      <TextField
        label="Name (optional)"
        name="displayName"
        autoComplete="name"
        maxLength={100}
        errors={fieldErrors?.displayName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.status === "error" ? state.email : undefined}
        errors={fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        errors={fieldErrors?.password}
      />
      {timezone && (
        <p className="text-xs text-muted-foreground">Your timezone will be set to {timezone}.</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
