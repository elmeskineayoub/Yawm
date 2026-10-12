"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { createIdea } from "@/features/inbox/actions";
import { createTask } from "@/features/tasks/actions";
import { cn } from "@/lib/utils";

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Persistent capture for an idea or a task, available on every page. Press "q" anywhere outside a
 * text field to open it. The dialog closes only after the server has saved the entry.
 */
export function QuickCapture({ collapsed = false }: { collapsed?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"idea" | "task">("idea");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "q" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          className={cn("w-full", collapsed && "px-0")}
          aria-keyshortcuts="q"
          title={collapsed ? "Quick capture (q)" : "Shortcut: q"}
        >
          <Plus aria-hidden className="size-4" />
          <span className={cn(collapsed && "sr-only")}>Quick capture</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-[15%] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-border bg-background p-5 shadow-lg">
          <Dialog.Title className="text-base font-semibold">Quick capture</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Get it out of your head. You can organise it later.
          </Dialog.Description>
          <form
            className="mt-4 space-y-3"
            action={(formData) =>
              startTransition(async () => {
                const result =
                  kind === "idea" ? await createIdea(formData) : await createTask(formData);
                if (result.ok) {
                  setOpen(false);
                  setError(null);
                  toast.success(kind === "idea" ? "Saved to Inbox" : "Task added");
                } else {
                  setError(result.fieldErrors?.title?.[0] ?? result.error);
                }
              })
            }
          >
            <fieldset className="flex gap-4 text-sm">
              <legend className="sr-only">Capture as</legend>
              {(["idea", "task"] as const).map((value) => (
                <label key={value} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                  />
                  {value === "idea" ? "Idea" : "Task"}
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor={`${id}-title`} className="sr-only">
                {kind === "idea" ? "Idea" : "Task title"}
              </label>
              <input
                id={`${id}-title`}
                name="title"
                required
                maxLength={500}
                autoFocus
                placeholder={kind === "idea" ? "What's on your mind?" : "What needs doing?"}
                aria-invalid={error ? true : undefined}
                className={controlClass}
              />
            </div>
            {kind === "idea" ? (
              <div>
                <label htmlFor={`${id}-body`} className="sr-only">
                  Details
                </label>
                <textarea
                  id={`${id}-body`}
                  name="body"
                  rows={3}
                  maxLength={20000}
                  placeholder="Details (optional)"
                  className={controlClass}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor={`${id}-due`}>Due</label>
                <input
                  id={`${id}-due`}
                  type="date"
                  name="due_date"
                  className={cn(controlClass, "w-auto")}
                />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Dialog.Close>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
