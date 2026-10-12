"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";
import { ProgressBar } from "@/components/ui/progress-bar";
import { setMilestoneDone } from "@/features/goals/actions";
import {
  addPriority,
  linkToPlan,
  unlinkFromPlan,
  type LinkableKind,
} from "@/features/planning/actions";
import { linkedId, type PlanItemView } from "@/features/planning/queries";
import { cn } from "@/lib/utils";
import { LinkPopover } from "./link-popover";

type PriorityListProps = {
  period: string;
  start: string;
  items: PlanItemView[];
  /** What typing a new item creates: a goal (year), project (month), or task (week/day). */
  kind: "task" | "project" | "goal";
  /** What "Link existing" searches. */
  linkKinds: LinkableKind[];
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
  linkKinds,
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

  const linkedIds = items.map(linkedId);

  return (
    <section aria-labelledby={`${id}-h`}>
      <div className="flex items-center justify-between gap-2">
        <h2
          id={`${id}-h`}
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {heading}
        </h2>
        <LinkPopover
          linkedIds={linkedIds}
          kinds={linkKinds}
          onLink={(item) => linkToPlan(period, start, item.kind, item.id)}
        />
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
              <OutcomeItem key={item.id} item={item} onRemove={remove} />
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

function OutcomeItem({
  item,
  onRemove,
}: {
  item: Exclude<PlanItemView, { kind: "task" }>;
  onRemove: (itemId: string, label: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const title =
    item.kind === "project"
      ? item.project.name
      : item.kind === "goal"
        ? item.goal.title
        : item.milestone.title;
  const href =
    item.kind === "project"
      ? `/projects/${item.project.id}`
      : item.kind === "goal"
        ? `/goals/${item.goal.id}`
        : `/goals/${item.milestone.goal_id}`;

  return (
    <li className="group flex items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-surface-muted">
      {item.kind === "milestone" ? (
        <input
          type="checkbox"
          aria-label={`Milestone “${title}” done`}
          checked={item.milestone.completed_at !== null}
          disabled={pending}
          onChange={(e) =>
            startTransition(async () => {
              const result = await setMilestoneDone(item.milestone.id, e.target.checked);
              if (!result.ok) toast.error(result.error);
            })
          }
          className="mt-1 size-4 accent-[var(--accent)]"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "mt-1.5 size-2.5 shrink-0 bg-accent",
            item.kind === "goal" ? "rounded-full" : "rounded-sm",
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className={cn(
            "text-sm break-words hover:underline",
            item.kind === "milestone" &&
              item.milestone.completed_at &&
              "text-muted-foreground line-through",
          )}
        >
          {title}
        </Link>
        {item.kind === "goal" && <span className="sr-only"> (goal)</span>}
        {item.kind === "milestone" && (
          <p className="text-xs text-muted-foreground">
            {item.milestone.goal_title}
            {item.milestone.due_date && ` · due ${item.milestone.due_date}`}
          </p>
        )}
        {item.kind === "project" && item.project.progress.total > 0 && (
          <div className="mt-1 max-w-48">
            <ProgressBar progress={item.project.progress} label={`${title} progress`} />
          </div>
        )}
        {item.kind === "goal" && item.goal.progress.milestones.total > 0 && (
          <p className="text-xs text-muted-foreground">
            {item.goal.progress.milestones.done}/{item.goal.progress.milestones.total} milestones
            {item.goal.next && ` · next: ${item.goal.next.title}`}
          </p>
        )}
      </div>
      <RemoveButton label={title} onClick={() => onRemove(item.id, title)} />
    </li>
  );
}
