"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { createEntry } from "@/features/journal/actions";
import { JOURNAL_PROMPTS } from "@/features/journal/logic";
import { cn } from "@/lib/utils";

/** Start a new dated entry: pick a date and, optionally, a prompt or the daily template. */
export function NewEntry({ today }: { today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [prompt, setPrompt] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3"
      action={() =>
        startTransition(async () => {
          const result = await createEntry({ entry_date: date, prompt: prompt || null });
          if (result.ok) {
            setError(null);
            toast.success("Entry created");
            router.push(`/journal/${result.data.id}`);
          } else {
            setError(result.error);
          }
        })
      }
    >
      <div className="space-y-1">
        <label htmlFor="new-entry-date" className="block text-xs font-medium text-muted-foreground">
          Date
        </label>
        <input
          id="new-entry-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cn(controlClass, "w-auto py-1.5")}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <label
          htmlFor="new-entry-prompt"
          className="block text-xs font-medium text-muted-foreground"
        >
          Start from
        </label>
        <select
          id="new-entry-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={cn(controlClass, "py-1.5")}
        >
          <option value="">Blank entry</option>
          <option value="__template__">Daily reflection (all prompts)</option>
          {JOURNAL_PROMPTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending} className="py-2">
        {pending ? "Creating…" : "New entry"}
      </Button>
      {error && (
        <p role="alert" className="w-full text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
