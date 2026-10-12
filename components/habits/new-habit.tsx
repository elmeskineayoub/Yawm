"use client";

import { Plus } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { controlClass } from "@/components/ui/field";
import { createHabit } from "@/features/habits/actions";
import { cn } from "@/lib/utils";

/** Add a habit by name. It starts as a daily yes/no habit; the details page changes the rest. */
export function NewHabit() {
  const id = useId();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createHabit(title);
          if (!result.ok) {
            setError(result.fieldErrors?.title?.[0] ?? result.error);
            return;
          }
          setError(null);
          setTitle("");
          toast.success("Habit added", {
            description: "Every day by default. Open it to change the schedule or add a target.",
          });
        });
      }}
      className="space-y-1"
    >
      <div className="flex gap-2">
        <label htmlFor={`${id}-title`} className="sr-only">
          Add a habit
        </label>
        <input
          id={`${id}-title`}
          value={title}
          maxLength={200}
          placeholder="Add a habit, e.g. Read 20 pages"
          aria-invalid={error ? true : undefined}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(controlClass, "min-w-0 flex-1")}
        />
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-surface-muted disabled:opacity-50"
        >
          <Plus aria-hidden className="size-4" />
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
