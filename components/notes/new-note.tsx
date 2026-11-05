"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { controlClass } from "@/components/ui/field";
import { createNote } from "@/features/notes/actions";
import { safeAction } from "@/lib/safe-action";
import { cn } from "@/lib/utils";

/** Name a note and press Enter: it is created and opens, ready for writing. */
export function NewNote({ listQuery }: { listQuery: string }) {
  const id = useId();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      aria-label="New note"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.set("title", title);
        startTransition(async () => {
          const result = await safeAction(() => createNote(formData));
          if (!result.ok) {
            setError(result.fieldErrors?.title?.[0] ?? result.error);
            return;
          }
          setError(null);
          setTitle("");
          router.push(`/notes/${result.data.id}${listQuery ? `?${listQuery}` : ""}`);
        });
      }}
    >
      <label htmlFor={`${id}-title`} className="sr-only">
        New note
      </label>
      <div className="relative">
        <Plus
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={`${id}-title`}
          value={title}
          maxLength={200}
          disabled={pending}
          placeholder={pending ? "Creating…" : "New note: name it, press Enter"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(controlClass, "pl-8")}
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
