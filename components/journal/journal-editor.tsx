"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { saveEntry } from "@/features/journal/actions";
import { ENERGY_LABELS, MOOD_LABELS } from "@/features/journal/logic";
import { parseTagNames } from "@/lib/form";
import { cn } from "@/lib/utils";

type EntryForm = {
  entry_date: string;
  title: string;
  body: string;
  mood: string;
  energy: string;
  tags: string;
};

type Status = "idle" | "saving" | "saved" | "error" | "offline";

export type JournalEntryInit = {
  id: string;
  entry_date: string;
  title: string | null;
  body: string | null;
  mood: number | null;
  energy: number | null;
  prompt: string | null;
  tags: string[];
};

const AUTOSAVE_DELAY = 1200;

const serialize = (f: EntryForm) =>
  JSON.stringify([
    f.entry_date,
    f.title.trim(),
    f.body.trim(),
    f.mood,
    f.energy,
    parseTagNames(f.tags).join(","),
  ]);

const toForm = (entry: JournalEntryInit): EntryForm => ({
  entry_date: entry.entry_date,
  title: entry.title ?? "",
  body: entry.body ?? "",
  mood: entry.mood ? String(entry.mood) : "0",
  energy: entry.energy ? String(entry.energy) : "0",
  tags: entry.tags.join(", "),
});

function ScaleSelect({
  id,
  label,
  labels,
  value,
  onChange,
}: {
  id: string;
  label: string;
  labels: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={controlClass}
      >
        <option value="0">Not recorded</option>
        {labels.map((text, i) => (
          <option key={text} value={String(i + 1)}>
            {i + 1} — {text}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The journal editor autosaves on a short debounce and shows an honest state: "Saving…", "Saved"
 * (only after the server confirms), "Offline — not saved", or an error. The draft stays in the
 * fields on failure so nothing is lost. Content is never sent anywhere but Supabase.
 */
export function JournalEditor({ entry }: { entry: JournalEntryInit }) {
  const [form, setForm] = useState<EntryForm>(() => toForm(entry));
  const [savedPayload, setSavedPayload] = useState(() => serialize(toForm(entry)));
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Latest values for the async save, written in effects so render never reads a ref.
  const formRef = useRef(form);
  const savedRef = useRef(savedPayload);
  const savingRef = useRef(false);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    savedRef.current = savedPayload;
  }, [savedPayload]);

  const payload = serialize(form);
  const dirty = payload !== savedPayload;

  const field = (key: keyof EntryForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const flush = useCallback(async () => {
    if (savingRef.current) return;
    const current = formRef.current;
    const snapshot = serialize(current);
    if (snapshot === savedRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    savingRef.current = true;
    setStatus("saving");
    const result = await saveEntry(
      entry.id,
      {
        entry_date: current.entry_date,
        title: current.title,
        body: current.body,
        mood: current.mood === "0" ? null : Number(current.mood),
        energy: current.energy === "0" ? null : Number(current.energy),
        prompt: entry.prompt,
      },
      parseTagNames(current.tags),
    );
    savingRef.current = false;
    if (result.ok) {
      setSavedPayload(snapshot);
      setStatus("saved");
      setError(null);
    } else {
      setStatus("error");
      setError(result.error);
    }
  }, [entry.id, entry.prompt]);

  // Debounced autosave whenever the content changes. Depending on savedPayload reschedules a
  // follow-up save if the user kept typing while the previous save was in flight.
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => void flush(), AUTOSAVE_DELAY);
    return () => clearTimeout(id);
  }, [payload, dirty, savedPayload, flush]);

  // Retry when connectivity returns; flush before the tab is hidden.
  useEffect(() => {
    const onOnline = () => void flush();
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  let statusText = "";
  let isError = false;
  if (status === "saving") statusText = "Saving…";
  else if (status === "offline") {
    statusText = "Offline — not saved yet";
    isError = true;
  } else if (status === "error") {
    statusText = error ?? "Could not save";
    isError = true;
  } else if (dirty) statusText = "Unsaved changes…";
  else if (status === "saved") statusText = "Saved";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <label htmlFor="entry-date" className="block text-sm font-medium">
            Date
          </label>
          <input
            id="entry-date"
            type="date"
            value={form.entry_date}
            onChange={(e) => field("entry_date")(e.target.value)}
            onBlur={() => void flush()}
            className={cn(controlClass, "w-auto")}
          />
        </div>
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "text-sm",
            isError ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {statusText}
        </span>
      </div>

      <div className="space-y-1">
        <label htmlFor="entry-title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="entry-title"
          value={form.title}
          maxLength={200}
          placeholder="Optional title"
          onChange={(e) => field("title")(e.target.value)}
          onBlur={() => void flush()}
          className={controlClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="entry-body" className="block text-sm font-medium">
          Entry
        </label>
        <textarea
          id="entry-body"
          value={form.body}
          rows={16}
          maxLength={20000}
          placeholder="Write freely…"
          onChange={(e) => field("body")(e.target.value)}
          onBlur={() => void flush()}
          className={cn(controlClass, "min-h-64")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ScaleSelect
          id="entry-mood"
          label="Mood"
          labels={MOOD_LABELS}
          value={form.mood}
          onChange={field("mood")}
        />
        <ScaleSelect
          id="entry-energy"
          label="Energy"
          labels={ENERGY_LABELS}
          value={form.energy}
          onChange={field("energy")}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="entry-tags" className="block text-sm font-medium">
          Tags
        </label>
        <input
          id="entry-tags"
          value={form.tags}
          placeholder="Separate with commas"
          onChange={(e) => field("tags")(e.target.value)}
          onBlur={() => void flush()}
          className={controlClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void flush()} disabled={!dirty || status === "saving"}>
          Save now
        </Button>
        <span className="text-xs text-muted-foreground">
          Autosaves as you write. Journal entries stay private to your workspace.
        </span>
      </div>
    </div>
  );
}
