"use client";

import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { controlClass } from "@/components/ui/field";
import { saveNote } from "@/features/notes/actions";
import { parseTagNames } from "@/lib/form";
import { useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";

export type NoteLinkOptions = {
  projects: { id: string; name: string }[];
  goals: { id: string; title: string }[];
  tasks: { id: string; title: string }[];
};

export type NoteEditorInit = {
  id: string;
  title: string;
  body: string | null;
  project_id: string | null;
  goal_id: string | null;
  task_id: string | null;
  tags: string[];
};

type Draft = {
  title: string;
  body: string;
  project_id: string;
  goal_id: string;
  task_id: string;
  tags: string;
};

const toDraft = (note: NoteEditorInit): Draft => ({
  title: note.title,
  body: note.body ?? "",
  project_id: note.project_id ?? "",
  goal_id: note.goal_id ?? "",
  task_id: note.task_id ?? "",
  tags: note.tags.join(", "),
});

const serialize = (d: Draft) =>
  JSON.stringify([
    d.title.trim(),
    d.body.trim(),
    d.project_id,
    d.goal_id,
    d.task_id,
    parseTagNames(d.tags).join(","),
  ]);

/**
 * Write a note like a document: the title and body save on their own after a short pause (and
 * on blur), with an honest Saving / Saved / Offline state. Links and tags sit under "Details"
 * and save the same way. Content goes only to Supabase.
 */
export function NoteEditor({ note, options }: { note: NoteEditorInit; options: NoteLinkOptions }) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(note));
  const { statusText, isError, flush } = useAutosave({
    value: draft,
    serialize,
    validate: (d) => (d.title.trim() ? null : "Give the note a title to save it."),
    save: (d) =>
      saveNote(
        note.id,
        {
          title: d.title,
          body: d.body,
          project_id: d.project_id,
          goal_id: d.goal_id,
          task_id: d.task_id,
        },
        parseTagNames(d.tags),
      ),
  });
  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const linked = [draft.project_id, draft.goal_id, draft.task_id].filter(Boolean).length;
  const tagCount = parseTagNames(draft.tags).length;

  const select = (
    key: "project_id" | "goal_id" | "task_id",
    label: string,
    none: string,
    items: { id: string; label: string }[],
  ) => (
    <div className="space-y-1">
      <label htmlFor={`${id}-${key}`} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={`${id}-${key}`}
        value={draft[key]}
        onChange={(e) => set(key)(e.target.value)}
        className={controlClass}
      >
        <option value="">{none}</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex h-5 items-center justify-end">
        <span
          role="status"
          aria-live="polite"
          className={cn("text-xs", isError ? "text-danger" : "text-muted-foreground")}
        >
          {statusText}
        </span>
      </div>
      <label htmlFor={`${id}-title`} className="sr-only">
        Title
      </label>
      <input
        id={`${id}-title`}
        value={draft.title}
        maxLength={200}
        placeholder="Title"
        aria-invalid={!draft.title.trim() ? true : undefined}
        onChange={(e) => set("title")(e.target.value)}
        onBlur={() => void flush()}
        className="w-full bg-transparent font-serif text-2xl leading-tight outline-none placeholder:text-muted-foreground/60"
      />
      <label htmlFor={`${id}-body`} className="sr-only">
        Body
      </label>
      <textarea
        id={`${id}-body`}
        value={draft.body}
        maxLength={20000}
        placeholder="Start writing…"
        onChange={(e) => set("body")(e.target.value)}
        onBlur={() => void flush()}
        className="mt-4 min-h-[45vh] w-full resize-y bg-transparent font-serif text-[1.0625rem] leading-relaxed outline-none placeholder:text-muted-foreground/60"
      />
      <details className="group mt-6 border-t border-border pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          Details
          <span className="text-xs">
            {[
              linked && `${linked} link${linked === 1 ? "" : "s"}`,
              tagCount && `${tagCount} tag${tagCount === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {select(
            "project_id",
            "Project",
            "No project",
            options.projects.map((p) => ({ id: p.id, label: p.name })),
          )}
          {select(
            "goal_id",
            "Goal",
            "No goal",
            options.goals.map((g) => ({ id: g.id, label: g.title })),
          )}
          {select(
            "task_id",
            "Task",
            "No task",
            options.tasks.map((t) => ({ id: t.id, label: t.title })),
          )}
          <div className="space-y-1">
            <label htmlFor={`${id}-tags`} className="block text-sm font-medium">
              Tags
            </label>
            <input
              id={`${id}-tags`}
              value={draft.tags}
              onChange={(e) => set("tags")(e.target.value)}
              onBlur={() => void flush()}
              className={controlClass}
            />
            <p className="text-xs text-muted-foreground">Separate with commas.</p>
          </div>
        </div>
      </details>
    </div>
  );
}
