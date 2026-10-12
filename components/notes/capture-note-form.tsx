"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { createNote } from "@/features/notes/actions";
import { cn } from "@/lib/utils";

/** A title is enough to start a note; details are optional. Opens the new note after saving. */
export function CaptureNoteForm() {
  const id = useId();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showBody, setShowBody] = useState(false);

  return (
    <form
      ref={formRef}
      className="space-y-2 rounded-lg border border-border bg-surface p-3"
      action={(formData) =>
        startTransition(async () => {
          const result = await createNote(formData);
          if (result.ok) {
            setError(null);
            setShowBody(false);
            formRef.current?.reset();
            toast.success("Note created");
            router.push(`/notes/${result.data.id}`);
          } else {
            setError(result.fieldErrors?.title?.[0] ?? result.error);
          }
        })
      }
    >
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`${id}-title`} className="sr-only">
          Note title
        </label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={200}
          placeholder="New note title"
          aria-invalid={error ? true : undefined}
          className={cn(controlClass, "min-w-0 flex-1 basis-56")}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
      {showBody ? (
        <>
          <label htmlFor={`${id}-body`} className="sr-only">
            Body
          </label>
          <textarea
            id={`${id}-body`}
            name="body"
            maxLength={20000}
            rows={3}
            placeholder="Write something (optional)"
            className={controlClass}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowBody(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + Add body now
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
