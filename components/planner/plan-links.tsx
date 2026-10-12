"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { linkToPlan, unlinkFromPlan } from "@/features/planning/actions";
import { cn } from "@/lib/utils";

export function UnlinkButton({ itemId, label }: { itemId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="px-2 py-1 text-xs"
      disabled={pending}
      aria-label={`Remove “${label}” from this plan`}
      onClick={() =>
        startTransition(async () => {
          const result = await unlinkFromPlan(itemId);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      Remove
    </Button>
  );
}

type Choice = { id: string; label: string };

export function LinkWorkForm({
  period,
  start,
  tasks,
  projects,
}: {
  period: string;
  start: string;
  tasks: Choice[];
  projects: Choice[];
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  if (tasks.length === 0 && projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing left to link. Create{" "}
        <Link href="/tasks" className="text-accent hover:underline">
          tasks
        </Link>{" "}
        or{" "}
        <Link href="/projects" className="text-accent hover:underline">
          projects
        </Link>{" "}
        first.
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap gap-2"
      action={() => {
        const [kind, id] = value.split(":") as ["task" | "project", string];
        startTransition(async () => {
          const result = await linkToPlan(period, start, kind, id);
          if (result.ok) {
            setValue("");
            toast.success("Linked to plan");
          } else toast.error(result.error);
        });
      }}
    >
      <label htmlFor="link-work" className="sr-only">
        Task or project to link
      </label>
      <select
        id="link-work"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(controlClass, "w-auto min-w-0 flex-1")}
      >
        <option value="">Link an existing task or project…</option>
        {projects.length > 0 && (
          <optgroup label="Projects">
            {projects.map((p) => (
              <option key={p.id} value={`project:${p.id}`}>
                {p.label}
              </option>
            ))}
          </optgroup>
        )}
        {tasks.length > 0 && (
          <optgroup label="Open tasks">
            {tasks.map((t) => (
              <option key={t.id} value={`task:${t.id}`}>
                {t.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <Button type="submit" variant="secondary" disabled={!value || pending}>
        {pending ? "Linking…" : "Link"}
      </Button>
    </form>
  );
}
