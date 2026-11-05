"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { dialogClass, overlayClass } from "@/components/ui/surfaces";
import { createIdea } from "@/features/inbox/actions";
import { createTask } from "@/features/tasks/actions";
import type { ShellLayout } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

type QuickCaptureContextValue = { open: () => void };
const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

function useQuickCapture(): QuickCaptureContextValue {
  const value = useContext(QuickCaptureContext);
  if (!value) throw new Error("QuickCaptureButton must be inside QuickCaptureProvider.");
  return value;
}

/**
 * Persistent capture for an idea or a task, available on every page. One dialog per app shell,
 * opened by any QuickCaptureButton or by pressing "q" anywhere outside a text field. The dialog
 * closes only after the server has saved the entry.
 */
export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setOpen(true) }), []);
  return (
    <QuickCaptureContext.Provider value={value}>
      {children}
      <QuickCaptureDialog open={open} onOpenChange={setOpen} />
    </QuickCaptureContext.Provider>
  );
}

/** Opens the shell's quick-capture dialog. */
export function QuickCaptureButton({
  layout = "full",
  variant = "sidebar",
}: {
  /** Follows the sidebar: icon only in the rail. */
  layout?: ShellLayout;
  /** "tab" renders the round central button of the mobile tab bar. */
  variant?: "sidebar" | "tab";
}) {
  const { open } = useQuickCapture();
  if (variant === "tab") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Quick capture"
        className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-overlay transition-colors duration-150 hover:bg-accent/90"
      >
        <Plus aria-hidden className="size-5" />
      </button>
    );
  }
  return (
    <Button
      onClick={open}
      className={cn(
        "w-full",
        layout === "rail" && "px-0",
        layout === "responsive" && "max-lg:px-0",
      )}
      aria-keyshortcuts="q"
      title="Quick capture (q)"
    >
      <Plus aria-hidden className="size-4" />
      <span
        className={cn(layout === "rail" && "sr-only", layout === "responsive" && "max-lg:sr-only")}
      >
        Quick capture
      </span>
    </Button>
  );
}

function QuickCaptureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setOpen = onOpenChange;
  const id = useId();
  const [kind, setKind] = useState<"idea" | "task">("idea");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "q" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // Not on top of another dialog or side panel.
      if (document.querySelector("[role=dialog]")) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content className={cn(dialogClass, "top-[15%] max-w-lg translate-y-0 p-5")}>
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
              <p role="alert" className="text-sm text-danger">
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
