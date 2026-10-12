"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { controlClass } from "@/components/ui/field";
import { setTaskStatus } from "@/features/tasks/actions";
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/features/tasks/logic";
import { cn } from "@/lib/utils";

/** Keyboard-accessible way to move a task between Kanban columns. */
export function StatusSelect({
  taskId,
  title,
  status,
}: {
  taskId: string;
  title: string;
  status: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={`Status of “${title}”`}
      value={status}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(async () => {
          const result = await setTaskStatus(taskId, next);
          if (!result.ok) toast.error(result.error);
        });
      }}
      className={cn(controlClass, "w-auto py-1 text-xs")}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
