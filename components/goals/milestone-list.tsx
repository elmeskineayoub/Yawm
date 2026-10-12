"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { controlClass } from "@/components/ui/field";
import {
  addMilestone,
  deleteMilestone,
  moveMilestone,
  renameMilestone,
  setMilestoneDone,
  setMilestoneDue,
} from "@/features/goals/actions";
import type { Milestone } from "@/features/goals/queries";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/** Milestones edited in place: tick, rename, date, reorder (buttons work by keyboard), delete. */
export function MilestoneList({ goalId, milestones }: { goalId: string; milestones: Milestone[] }) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await work();
      if (!result.ok) toast.error(result.error);
      else after?.();
    });

  return (
    <div>
      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No milestones yet. Break the goal into a few checkpoints you can see yourself reaching.
        </p>
      ) : (
        <ol aria-label="Milestones" className="divide-y divide-border">
          {milestones.map((m, index) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              first={index === 0}
              last={index === milestones.length - 1}
              disabled={pending}
              run={run}
            />
          ))}
        </ol>
      )}
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          run(
            async () => {
              const result = await addMilestone(goalId, title);
              setError(result.ok ? null : result.error);
              return result;
            },
            () => setTitle(""),
          );
        }}
      >
        <label htmlFor={`${id}-add`} className="sr-only">
          Add a milestone
        </label>
        <input
          id={`${id}-add`}
          value={title}
          maxLength={200}
          disabled={pending}
          placeholder="+ Add a milestone"
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground hover:border-border focus:border-accent"
        />
        {error && (
          <p role="alert" className="px-2 text-xs text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

function MilestoneRow({
  milestone,
  first,
  last,
  disabled,
  run,
}: {
  milestone: Milestone;
  first: boolean;
  last: boolean;
  disabled: boolean;
  run: (work: () => Promise<ActionResult>, after?: () => void) => void;
}) {
  const [done, setDone] = useOptimistic(milestone.completed_at !== null);
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState(milestone.title);

  return (
    <li className="group flex flex-wrap items-center gap-2 py-1.5">
      <input
        type="checkbox"
        aria-label={`“${milestone.title}” done`}
        checked={done}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            setDone(next);
            const result = await setMilestoneDone(milestone.id, next);
            if (!result.ok) toast.error(result.error);
          });
        }}
        className="size-4 accent-[var(--accent)]"
      />
      <label className="sr-only" htmlFor={`m-${milestone.id}`}>
        Milestone title
      </label>
      <input
        id={`m-${milestone.id}`}
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim();
          if (!next) setDraft(milestone.title);
          else if (next !== milestone.title) run(() => renameMilestone(milestone.id, next));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(milestone.title);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "min-w-0 flex-1 basis-40 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm hover:border-border focus:border-accent",
          done && "text-muted-foreground line-through",
        )}
      />
      <label className="sr-only" htmlFor={`d-${milestone.id}`}>
        Due date for “{milestone.title}”
      </label>
      <input
        id={`d-${milestone.id}`}
        type="date"
        value={milestone.due_date ?? ""}
        disabled={disabled}
        onChange={(e) => run(() => setMilestoneDue(milestone.id, e.target.value || null))}
        className={cn(controlClass, "w-auto px-2 py-0.5 text-xs")}
      />
      <div className="flex">
        <IconButton
          label={`Move “${milestone.title}” up`}
          disabled={disabled || first}
          onClick={() => run(() => moveMilestone(milestone.id, "up"))}
        >
          <ArrowUp aria-hidden className="size-3.5" />
        </IconButton>
        <IconButton
          label={`Move “${milestone.title}” down`}
          disabled={disabled || last}
          onClick={() => run(() => moveMilestone(milestone.id, "down"))}
        >
          <ArrowDown aria-hidden className="size-3.5" />
        </IconButton>
        <IconButton
          label={`Delete “${milestone.title}”`}
          disabled={disabled}
          onClick={() => run(() => deleteMilestone(milestone.id))}
        >
          <Trash2 aria-hidden className="size-3.5" />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}
