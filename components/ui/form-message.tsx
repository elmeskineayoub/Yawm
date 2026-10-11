import type { FormState } from "@/features/auth/form-state";

/** Announces form-level errors and confirmations to assistive technology. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "error" && state.message) {
    return (
      <p
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {state.message}
      </p>
    );
  }
  if (state.status === "success") {
    return (
      <p
        role="status"
        className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
      >
        {state.message}
      </p>
    );
  }
  return null;
}
