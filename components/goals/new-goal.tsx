"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { controlClass } from "@/components/ui/field";
import { createGoal } from "@/features/goals/actions";
import { cn } from "@/lib/utils";

/** Add a goal by name; everything else is optional and edited on the goal itself. */
export function NewGoal() {
  const id = useId();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createGoal(title);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setError(null);
          setTitle("");
          toast.success("Goal added", {
            action: { label: "Open", onClick: () => router.push(`/goals/${result.data.id}`) },
          });
        });
      }}
      className="space-y-1"
    >
      <div className="flex gap-2">
        <label htmlFor={`${id}-title`} className="sr-only">
          Add a goal
        </label>
        <input
          id={`${id}-title`}
          value={title}
          maxLength={200}
          placeholder="Add a goal, e.g. Run a half marathon"
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
