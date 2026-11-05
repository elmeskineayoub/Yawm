/**
 * The quick-capture draft, kept in this tab's sessionStorage so an accidental close or a failed
 * save never loses what was typed (REQUIREMENTS 4: preserve quick-capture drafts locally). It is
 * only a draft: nothing counts as saved until the server confirms, and it is cleared then.
 */
export const CAPTURE_DRAFT_KEY = "yawm.capture.draft";

export type CaptureKind = "idea" | "task";

export type CaptureDraft = {
  kind: CaptureKind;
  title: string;
  body: string;
  /** ISO date or "" for no due date (tasks only). */
  due: string;
};

export const EMPTY_DRAFT: CaptureDraft = { kind: "idea", title: "", body: "", due: "" };

export function isDraftEmpty(draft: CaptureDraft): boolean {
  return draft.title.trim() === "" && draft.body.trim() === "";
}

/** Reads a stored draft defensively; anything malformed becomes the empty draft. */
export function parseDraft(raw: string | null): CaptureDraft {
  if (!raw) return EMPTY_DRAFT;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return EMPTY_DRAFT;
    const v = value as Record<string, unknown>;
    const text = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
    return {
      kind: v.kind === "task" ? "task" : "idea",
      title: text(v.title, 500),
      body: text(v.body, 20000),
      due: typeof v.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.due) ? v.due : "",
    };
  } catch {
    return EMPTY_DRAFT;
  }
}
