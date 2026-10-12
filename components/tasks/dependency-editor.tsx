"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { addDependency, removeDependency } from "@/features/tasks/actions";
import { STATUS_LABELS, type TaskStatus } from "@/features/tasks/logic";

type DepTask = { id: string; title: string; status: TaskStatus };

export function DependencyEditor({
  taskId,
  dependsOn,
  candidates,
}: {
  taskId: string;
  dependsOn: DepTask[];
  candidates: DepTask[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const available = candidates.filter((c) => !dependsOn.some((d) => d.id === c.id));

  return (
    <div className="space-y-3">
      {dependsOn.length === 0 ? (
        <p className="text-sm text-muted-foreground">This task doesn&apos;t wait on anything.</p>
      ) : (
        <ul className="space-y-1">
          {dependsOn.map((dep) => (
            <li key={dep.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <Link href={`/tasks/${dep.id}`} className="break-words hover:underline">
                  {dep.title}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">({STATUS_LABELS[dep.status]})</span>
              </span>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                disabled={pending}
                aria-label={`Remove dependency on “${dep.title}”`}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeDependency(taskId, dep.id);
                    if (!result.ok) toast.error(result.error);
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <form
          className="flex flex-col gap-2"
          action={() =>
            startTransition(async () => {
              const result = await addDependency(taskId, selected);
              if (result.ok) setSelected("");
              else toast.error(result.error);
            })
          }
        >
          <label htmlFor="depends-on" className="sr-only">
            Task this one waits on
          </label>
          <select
            id="depends-on"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={controlClass}
          >
            <option value="">Choose a task to wait on…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" disabled={!selected || pending}>
            Add dependency
          </Button>
        </form>
      )}
    </div>
  );
}
