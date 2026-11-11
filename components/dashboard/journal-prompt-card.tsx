"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createEntry } from "@/features/journal/actions";
import { safeAction } from "@/lib/safe-action";

/** Surfaces today's reflection prompt and starts a journal entry seeded with it. */
export function JournalPromptCard({
  prompt,
  today,
  variant = "primary",
}: {
  prompt: string;
  today: string;
  /** "secondary" where the page already has its one primary action (the Dashboard). */
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <p className="text-sm">{prompt}</p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button
          size="sm"
          variant={variant}
          className="text-sm pointer-coarse:min-h-tap"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await safeAction(() => createEntry({ entry_date: today, prompt }));
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
        <Link href="/journal" className="tap-target text-sm text-link">
          Open journal
        </Link>
      </div>
    </div>
  );
}
