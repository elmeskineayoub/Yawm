export type FieldErrors = Partial<Record<string, string[]>>;

/** Result of a server action. `ok` is only true after the database confirmed the write. */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: FieldErrors,
): { ok: false; error: string; fieldErrors?: FieldErrors } {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** State for forms driven by `useActionState`. */
export type SaveState =
  | { status: "idle" }
  | { status: "saved"; savedAt: number; message?: string }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

export const idleSaveState: SaveState = { status: "idle" };

export function toSaveState(result: ActionResult<unknown>, message?: string): SaveState {
  if (result.ok) return { status: "saved", savedAt: Date.now(), ...(message ? { message } : {}) };
  return { status: "error", message: result.error, fieldErrors: result.fieldErrors };
}
