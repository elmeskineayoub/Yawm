import type { FieldErrors } from "./schemas";

export type FormState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: FieldErrors; email?: string }
  | { status: "success"; message: string };

export const initialFormState: FormState = { status: "idle" };
