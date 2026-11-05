import type { FormState } from "@/features/auth/form-state";

/** Announces form-level errors and confirmations to assistive technology. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "error" && state.message) {
    return (
      <p
        role="alert"
        className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
      >
        {state.message}
      </p>
    );
  }
  if (state.status === "success") {
    return (
      <p
        role="status"
        className="rounded-md border border-success/25 bg-success-soft px-3 py-2 text-sm text-success"
      >
        {state.message}
      </p>
    );
  }
  return null;
}
