"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createEntry } from "@/features/journal/actions";

/** Surfaces today's reflection prompt and starts a journal entry seeded with it. */
export function JournalPromptCard({ prompt, today }: { prompt: string; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <p className="text-sm">{prompt}</p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button
          className="px-3 py-1.5 text-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await createEntry({ entry_date: today, prompt });
              if (result.ok) router.push(`/journal/${result.data.id}`);
              else {
                setError(result.error);
                toast.error(result.error);
              }
            })
          }
        >
          {pending ? "Starting…" : "Write about this"}
        </Button>
        <Link href="/journal" className="text-sm text-accent hover:underline">
          Open journal
        </Link>
      </div>
    </div>
  );
}
