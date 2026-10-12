"use client";

import { Pencil } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { savePlanField } from "@/features/planning/actions";
import { cn } from "@/lib/utils";

type InlineTextProps = {
  period: string;
  start: string;
  field: "theme" | "focus" | "reflection";
  value: string | null;
  label: string;
  placeholder: string;
  multiline?: boolean;
  maxLength: number;
  className?: string;
};

type Status = "idle" | "saving" | "saved" | "error";

/**
 * Click-to-edit text that saves itself on blur or Enter (Cmd/Ctrl+Enter for multi-line) and
 * reverts on Escape. "Saved" appears only after the server confirms; on error the draft stays
 * in the field so nothing is lost.
 */
export function InlineText({
  period,
  start,
  field,
  value,
  label,
  placeholder,
  multiline = false,
  maxLength,
  className,
}: InlineTextProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saved, setSaved] = useState(value ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setDraft(saved);
    setEditing(false);
    setStatus("idle");
  };

  const commit = () => {
    const next = draft.trim();
    if (next === saved.trim()) {
      setEditing(false);
      return;
    }
    setStatus("saving");
    startTransition(async () => {
      const result = await savePlanField(period, start, field, next);
      if (result.ok) {
        setSaved(next);
        setDraft(next);
        setStatus("saved");
        setError(null);
        setEditing(false);
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  };

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? error
          : "";

  const editorClass = "mt-1 block w-full rounded-md border border-accent bg-background px-2 py-1.5";

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </label>
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "text-xs",
            status === "error" ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {statusText}
        </span>
      </div>
      {editing ? (
        multiline ? (
          <textarea
            id={id}
            ref={inputRef}
            value={draft}
            maxLength={maxLength}
            rows={4}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commit();
              }
            }}
            className={cn(editorClass, "text-sm")}
          />
        ) : (
          <input
            id={id}
            ref={inputRef}
            value={draft}
            maxLength={maxLength}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              else if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            className={cn(editorClass, "text-base font-medium")}
          />
        )
      ) : (
        <button
          id={id}
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "group mt-1 flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-muted",
            multiline ? "text-sm whitespace-pre-wrap" : "text-base font-medium",
            !saved && "font-normal text-muted-foreground",
          )}
        >
          <span className="min-w-0 break-words">{saved || placeholder}</span>
          <Pencil
            aria-hidden
            className="mt-1 size-3.5 shrink-0 opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"
          />
        </button>
      )}
    </div>
  );
}
