"use client";

import { X } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { LinkPopover } from "@/components/planner/link-popover";
import { controlClass } from "@/components/ui/field";
import { linkToGoal } from "@/features/goals/actions";
import { cn } from "@/lib/utils";

/** "Link existing" for a goal: searches projects and open tasks. */
export function GoalLinkPicker({ goalId, linkedIds }: { goalId: string; linkedIds: string[] }) {
  return (
    <LinkPopover
      linkedIds={linkedIds}
      kinds={["project", "task"]}
      onLink={(item) => linkToGoal(item.kind === "project" ? "project" : "task", item.id, goalId)}
    />
  );
}

export function UnlinkFromGoal({
  kind,
  targetId,
  label,
}: {
  kind: "project" | "task";
  targetId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Unlink “${label}” from this goal`}
      title="Unlink from this goal"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await linkToGoal(kind, targetId, null);
          if (result.ok) toast.success(`Unlinked “${label}”. It still exists.`);
          else toast.error(result.error);
        })
      }
      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}

/** A project's or task's goal, chosen from a list and saved on change. */
export function GoalSelect({
  kind,
  targetId,
  goalId,
  goals,
}: {
  kind: "project" | "task";
  targetId: string;
  goalId: string | null;
  goals: { id: string; title: string }[];
}) {
  const id = useId();
  const [value, setValue] = useState(goalId ?? "");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium">
          Goal
        </label>
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {status}
        </span>
      </div>
      <select
        id={id}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const previous = value;
          setValue(next);
          startTransition(async () => {
            setStatus("Saving…");
            const result = await linkToGoal(kind, targetId, next || null);
            if (result.ok) setStatus("Saved");
            else {
              setValue(previous);
              setStatus(result.error);
            }
          });
        }}
        className={cn(controlClass)}
      >
        <option value="">No goal</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
      </select>
    </div>
  );
}
