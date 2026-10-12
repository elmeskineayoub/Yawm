import type { SaveState } from "@/lib/action-result";

/** Honest save indicator: "Saved" appears only after the server confirmed the write. */
export function SaveStatus({ pending, state }: { pending: boolean; state: SaveState }) {
  let text = "";
  let className = "text-muted-foreground";
  if (pending) text = "Saving…";
  else if (state.status === "saved") text = state.message ?? "Saved";
  else if (state.status === "error") {
    text = state.message;
    className = "text-red-700 dark:text-red-400";
  }
  return (
    <span role="status" aria-live="polite" className={`text-sm ${className}`}>
      {text}
    </span>
  );
}
