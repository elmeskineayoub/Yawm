"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setTaskStatus } from "@/features/tasks/actions";
import type { TaskPriority, TaskStatus } from "@/features/tasks/logic";
import { cn } from "@/lib/utils";

// Priority shows as the ring colour (urgent and high also keep a text badge in the row, so
// priority is never conveyed by colour alone).
const RING: Record<TaskPriority, string> = {
  urgent: "border-priority-urgent bg-danger-soft hover:border-priority-urgent",
  high: "border-priority-high bg-warning-soft hover:border-priority-high",
  medium: "border-muted-foreground/60 hover:border-accent",
  low: "border-muted-foreground/35 hover:border-accent",
};

/**
 * Completes or reopens a task. The tick shows immediately and rolls back if the server rejects
 * the change (for example, when the task is blocked by a dependency). Completing a one-off task
 * offers Undo; a recurring one does not, because completing it already created the next occurrence
 * and reopening would leave two open copies.
 */
export function TaskCheckbox({
  taskId,
  title,
  status,
  priority = "medium",
  recurring = false,
}: {
  taskId: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  recurring?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(status === "done");

  const toggle = () =>
    startTransition(async () => {
      const completing = !optimisticDone;
      const previous = status;
      setOptimisticDone(completing);
      const result = await setTaskStatus(taskId, completing ? "done" : "todo");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!completing) return;
      if (recurring) {
        toast.success(`Completed “${title}”. The next one is on your list.`);
        return;
      }
      toast.success(`Completed “${title}”`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await setTaskStatus(taskId, previous === "done" ? "todo" : previous);
            if (!undo.ok) toast.error(undo.error);
          },
        },
      });
    });

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticDone}
      aria-label={optimisticDone ? `Reopen “${title}”` : `Complete “${title}”`}
      disabled={pending || status === "cancelled"}
      onClick={toggle}
      className={cn(
        "flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-150 disabled:opacity-50",
        optimisticDone ? "border-accent bg-accent text-accent-foreground" : RING[priority],
      )}
    >
      {optimisticDone && <Check aria-hidden className="size-3" strokeWidth={3} />}
    </button>
  );
}
