"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";
import { ProgressBar } from "@/components/ui/progress-bar";
import { addPriority, unlinkFromPlan } from "@/features/planning/actions";
import type { PlanItemView } from "@/features/planning/queries";
import { cn } from "@/lib/utils";
import { LinkPopover } from "./link-popover";

type PriorityListProps = {
  period: string;
  start: string;
  items: PlanItemView[];
  /** Outcomes (month/year) are created as projects; priorities (week/day) as tasks. */
  kind: "task" | "project";
  heading: string;
  addLabel: string;
  emptyText: string;
  softLimit?: number;
};

export function PriorityList({
  period,
  start,
  items,
  kind,
  heading,
  addLabel,
  emptyText,
  softLimit,
}: PriorityListProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await addPriority(period, start, kind, title);
      if (result.ok) {
        setTitle("");
        setError(null);
        inputRef.current?.focus();
      } else setError(result.error);
    });

  const remove = (itemId: string, label: string) =>
    startTransition(async () => {
      const result = await unlinkFromPlan(itemId);
      if (result.ok) toast.success(`Removed “${label}” from this plan. It still exists.`);
      else toast.error(result.error);
    });

  const linkedIds = items.map((i) => (i.kind === "task" ? i.task.id : i.project.id));

  return (
    <section aria-labelledby={`${id}-h`}>
      <div className="flex items-center justify-between gap-2">
        <h2
          id={`${id}-h`}
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {heading}
        </h2>
        <LinkPopover period={period} start={start} linkedIds={linkedIds} />
      </div>

      {items.length === 0 ? (
        <p className="mt-1 px-1 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul aria-label={heading} className="mt-1">
          {items.map((item) =>
            item.kind === "task" ? (
              <li
                key={item.id}
                className="group flex items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-surface-muted"
              >
                <div className="pt-0.5">
                  <TaskCheckbox
                    taskId={item.task.id}
                    title={item.task.title}
                    status={item.task.status}
                  />
                </div>
                <Link
                  href={`/tasks/${item.task.id}`}
                  className={cn(
                    "min-w-0 flex-1 text-sm break-words hover:underline",
                    item.task.status === "done" && "text-muted-foreground line-through",
                  )}
                >
                  {item.task.title}
                </Link>
                <RemoveButton
                  label={item.task.title}
                  onClick={() => remove(item.id, item.task.title)}
                />
              </li>
            ) : (
              <li
                key={item.id}
                className="group flex items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-surface-muted"
              >
                <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-sm bg-accent" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/projects/${item.project.id}`}
                    className="text-sm break-words hover:underline"
                  >
                    {item.project.name}
                  </Link>
                  {item.project.progress.total > 0 && (
                    <div className="mt-1 max-w-48">
                      <ProgressBar
                        progress={item.project.progress}
                        label={`${item.project.name} progress`}
                      />
                    </div>
                  )}
                </div>
                <RemoveButton
                  label={item.project.name}
                  onClick={() => remove(item.id, item.project.name)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      {softLimit !== undefined && items.length > softLimit && (
        <p className="mt-1 px-1 text-xs text-muted-foreground">
          {items.length} priorities. A shorter list is usually more achievable.
        </p>
      )}

      <form
        className="mt-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add();
        }}
      >
        <label htmlFor={`${id}-add`} className="sr-only">
          {addLabel}
        </label>
        <input
          id={`${id}-add`}
          ref={inputRef}
          value={title}
          maxLength={200}
          disabled={pending}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`+ ${addLabel}`}
          aria-invalid={error ? true : undefined}
          className="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground hover:border-border focus:border-accent"
        />
        {error && (
          <p role="alert" className="px-2 text-xs text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove “${label}” from this plan`}
      title="Remove from this plan"
      className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}
