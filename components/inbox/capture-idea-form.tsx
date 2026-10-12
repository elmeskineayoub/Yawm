"use client";

import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { createIdea } from "@/features/inbox/actions";
import { cn } from "@/lib/utils";

/** Capture needs only a title; details are optional. Cleared only after the server saved it. */
export function CaptureIdeaForm() {
  const id = useId();
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
          const result = await createIdea(formData);
          if (result.ok) {
            setError(null);
            setShowBody(false);
            formRef.current?.reset();
            toast.success("Idea captured");
          } else {
            setError(result.fieldErrors?.title?.[0] ?? result.error);
          }
        })
      }
    >
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`${id}-title`} className="sr-only">
          Idea
        </label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={500}
          placeholder="What's on your mind?"
          aria-invalid={error ? true : undefined}
          className={cn(controlClass, "min-w-0 flex-1 basis-56")}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Capture"}
        </Button>
      </div>
      {showBody ? (
        <>
          <label htmlFor={`${id}-body`} className="sr-only">
            Details
          </label>
          <textarea
            id={`${id}-body`}
            name="body"
            maxLength={20000}
            rows={3}
            placeholder="Details (optional)"
            className={controlClass}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowBody(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + Add details
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
