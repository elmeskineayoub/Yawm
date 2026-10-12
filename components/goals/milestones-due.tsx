"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setMilestoneDone } from "@/features/goals/actions";
import type { MilestoneDue } from "@/features/goals/queries";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Milestones with a due date in the period, each linked to its goal. */
export function MilestonesDue({ milestones }: { milestones: MilestoneDue[] }) {
  return (
    <ul aria-label="Milestones due" className="mt-1">
      {milestones.map((m) => (
        <MilestoneDueRow key={m.id} milestone={m} />
      ))}
    </ul>
  );
}

function MilestoneDueRow({ milestone }: { milestone: MilestoneDue }) {
  const [done, setDone] = useOptimistic(milestone.completed_at !== null);
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-surface-muted">
      <input
        type="checkbox"
        aria-label={`Milestone “${milestone.title}” done`}
        checked={done}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            setDone(next);
            const result = await setMilestoneDone(milestone.id, next);
            if (!result.ok) toast.error(result.error);
          });
        }}
        className="mt-1 size-4 accent-[var(--accent)]"
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/goals/${milestone.goal_id}`}
          className={cn("text-sm hover:underline", done && "text-muted-foreground line-through")}
        >
          {milestone.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {milestone.goal_title}
          {milestone.due_date && ` · ${formatDate(milestone.due_date, "short")}`}
        </p>
      </div>
    </li>
  );
}
