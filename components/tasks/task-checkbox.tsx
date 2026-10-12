"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setTaskStatus } from "@/features/tasks/actions";
import type { TaskStatus } from "@/features/tasks/logic";
import { cn } from "@/lib/utils";

/**
 * Completes or reopens a task. The tick shows immediately and rolls back if the server rejects
 * the change (for example, when the task is blocked by a dependency).
 */
export function TaskCheckbox({
  taskId,
  title,
  status,
}: {
  taskId: string;
  title: string;
  status: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(status === "done");

  const toggle = () =>
    startTransition(async () => {
      const next = optimisticDone ? "todo" : "done";
      setOptimisticDone(next === "done");
      const result = await setTaskStatus(taskId, next);
      if (!result.ok) toast.error(result.error);
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
        "flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/60 hover:border-accent disabled:opacity-50",
        optimisticDone && "border-accent bg-accent text-accent-foreground",
      )}
    >
      {optimisticDone && <Check aria-hidden className="size-3" strokeWidth={3} />}
    </button>
  );
}
