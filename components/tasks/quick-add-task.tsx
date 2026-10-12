"use client";

import { Plus } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { createTask } from "@/features/tasks/actions";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/features/tasks/logic";
import { cn } from "@/lib/utils";

type QuickAddTaskProps = {
  projectId?: string;
  parentTaskId?: string;
  planId?: string;
  defaultDueDate?: string;
  placeholder?: string;
  compact?: boolean;
};

/** One-line task creation. The form clears only after the server has saved the task. */
export function QuickAddTask({
  projectId,
  parentTaskId,
  planId,
  defaultDueDate,
  placeholder = "Add a task",
  compact = false,
}: QuickAddTaskProps) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          const result = await createTask(formData);
          if (result.ok) {
            setError(null);
            formRef.current?.reset();
            toast.success("Task added");
          } else {
            setError(result.fieldErrors?.title?.[0] ?? result.error);
          }
        })
      }
      className="space-y-1"
    >
      {projectId && <input type="hidden" name="project_id" value={projectId} />}
      {parentTaskId && <input type="hidden" name="parent_task_id" value={parentTaskId} />}
      {planId && <input type="hidden" name="plan_id" value={planId} />}
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`${id}-title`}>
          Task title
        </label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={500}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={cn(controlClass, "min-w-0 flex-1 basis-48")}
        />
        {!compact && (
          <>
            <label className="sr-only" htmlFor={`${id}-due`}>
              Due date
            </label>
            <input
              id={`${id}-due`}
              type="date"
              name="due_date"
              defaultValue={defaultDueDate}
              className={cn(controlClass, "w-auto")}
            />
            <label className="sr-only" htmlFor={`${id}-priority`}>
              Priority
            </label>
            <select
              id={`${id}-priority`}
              name="priority"
              defaultValue="medium"
              className={cn(controlClass, "w-auto")}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </>
        )}
        {compact && defaultDueDate && (
          <input type="hidden" name="due_date" value={defaultDueDate} />
        )}
        <Button type="submit" disabled={pending}>
          <Plus aria-hidden className="size-4" />
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
