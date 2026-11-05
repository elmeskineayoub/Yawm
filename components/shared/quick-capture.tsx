"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { dialogClass, overlayClass } from "@/components/ui/surfaces";
import { createIdea } from "@/features/inbox/actions";
import { createTask } from "@/features/tasks/actions";
import {
  CAPTURE_DRAFT_KEY,
  EMPTY_DRAFT,
  isDraftEmpty,
  parseDraft,
  type CaptureDraft,
  type CaptureKind,
} from "@/lib/capture-draft";
import { addDays, type IsoDate } from "@/lib/dates";
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
export function QuickCaptureProvider({
  children,
  today = null,
}: {
  children: ReactNode;
  /** The user's current date in their profile timezone; enables "Today" / "Tomorrow". */
  today?: IsoDate | null;
}) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setOpen(true) }), []);
  return (
    <QuickCaptureContext.Provider value={value}>
      {children}
      <QuickCaptureDialog open={open} onOpenChange={setOpen} today={today} />
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

function readDraft(): CaptureDraft {
  try {
    return parseDraft(window.sessionStorage.getItem(CAPTURE_DRAFT_KEY));
  } catch {
    return EMPTY_DRAFT;
  }
}
function writeDraft(draft: CaptureDraft) {
  try {
    if (isDraftEmpty(draft)) window.sessionStorage.removeItem(CAPTURE_DRAFT_KEY);
    else window.sessionStorage.setItem(CAPTURE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable (private mode, quota); the open dialog still holds the text.
  }
}

function QuickCaptureDialog({
  open,
  onOpenChange,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: IsoDate | null;
}) {
  const setOpen = onOpenChange;

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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content className={cn(dialogClass, "top-[12%] max-w-lg translate-y-0 p-5")}>
          {/* Mounted only while open, so each opening reads the latest draft. */}
          {open && <CaptureForm today={today} onClose={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CaptureForm({ today, onClose }: { today: IsoDate | null; onClose: () => void }) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [initial] = useState(readDraft);
  const [draft, setDraft] = useState<CaptureDraft>(initial);
  const [restored, setRestored] = useState(!isDraftEmpty(initial));
  const [addAnother, setAddAnother] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const kind = draft.kind;

  const update = (patch: Partial<CaptureDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    writeDraft(next);
  };

  const submit = (formData: FormData) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = kind === "idea" ? await createIdea(formData) : await createTask(formData);
        if (!result.ok) {
          setError(result.fieldErrors?.title?.[0] ?? result.error);
          return;
        }
      } catch {
        // The request never reached the server (offline, network drop). Nothing was saved.
        setError(
          typeof navigator !== "undefined" && !navigator.onLine
            ? "You're offline, so this wasn't saved. It's kept here; save again when you're back online."
            : "Couldn't reach the server, so this wasn't saved. It's kept here; try again.",
        );
        return;
      }
      // Saved (server confirmed). Only now is the draft discarded.
      toast.success(kind === "idea" ? "Saved to Inbox" : "Task added");
      const cleared = { ...EMPTY_DRAFT, kind };
      setDraft(cleared);
      writeDraft(cleared);
      setRestored(false);
      if (addAnother) titleRef.current?.focus();
      else onClose();
    });

  const dueChoices = today
    ? [
        { value: today, label: "Today" },
        { value: addDays(today, 1), label: "Tomorrow" },
        { value: "", label: "No date" },
      ]
    : null;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Dialog.Title className="text-base font-semibold">Quick capture</Dialog.Title>
          <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
            Get it out of your head. Sort it later.
          </Dialog.Description>
        </div>
        <SegmentedControl<CaptureKind>
          label="Capture as"
          size="sm"
          value={kind}
          onChange={(next) => {
            update({ kind: next });
            titleRef.current?.focus();
          }}
          items={[
            { value: "idea", label: "Idea" },
            { value: "task", label: "Task" },
          ]}
        />
      </div>

      {restored && (
        <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          Draft restored from earlier.
          <button
            type="button"
            className="text-accent underline-offset-2 hover:underline"
            onClick={() => {
              const cleared = { ...EMPTY_DRAFT, kind };
              setDraft(cleared);
              writeDraft(cleared);
              setRestored(false);
              titleRef.current?.focus();
            }}
          >
            Clear
          </button>
        </p>
      )}

      <form ref={formRef} className="mt-4 space-y-3" action={submit}>
        <div>
          <label htmlFor={`${id}-title`} className="sr-only">
            {kind === "idea" ? "Idea" : "Task title"}
          </label>
          <input
            ref={titleRef}
            id={`${id}-title`}
            name="title"
            required
            maxLength={500}
            autoFocus
            autoComplete="off"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder={kind === "idea" ? "What's on your mind?" : "What needs doing?"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(controlClass, "text-[0.9375rem]")}
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
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              placeholder="Details (optional)"
              className={controlClass}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden className="text-sm text-muted-foreground">
              Due
            </span>
            {dueChoices && (
              <SegmentedControl
                label="Due date shortcut"
                size="sm"
                value={dueChoices.find((c) => c.value === draft.due)?.value ?? "custom"}
                onChange={(value) => update({ due: value === "custom" ? draft.due : value })}
                items={dueChoices.map((c) => ({ value: c.value, label: c.label }))}
              />
            )}
            <label htmlFor={`${id}-due`} className="sr-only">
              Due date
            </label>
            <input
              id={`${id}-due`}
              type="date"
              name="due_date"
              value={draft.due}
              onChange={(e) => update({ due: e.target.value })}
              className={cn(controlClass, "w-auto py-1.5")}
            />
          </div>
        )}

        {error && (
          <p id={`${id}-error`} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={addAnother}
              onChange={(e) => setAddAnother(e.target.checked)}
              className="size-4"
            />
            Add another
          </label>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Kbd>Enter</Kbd> to save
            </span>
            {/* Escape or clicking outside keeps the draft; this button says what it does. */}
            <Dialog.Close asChild>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!isDraftEmpty(draft)) writeDraft({ ...EMPTY_DRAFT, kind });
                }}
              >
                {isDraftEmpty(draft) ? "Cancel" : "Discard"}
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
