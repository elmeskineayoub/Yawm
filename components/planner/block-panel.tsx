"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { createBlock, deleteBlock, updateBlock } from "@/features/calendar/actions";
import { overlapsWith } from "@/features/calendar/logic";
import type { CalendarBlock, SchedulableTask } from "@/features/calendar/queries";
import type { BlockSyncState, ExternalEvent } from "@/features/google-calendar/types";
import { addDays } from "@/lib/dates";
import { formatTimeRange, instantToLocal, localToInstant } from "@/lib/dates/zoned";
import { cn } from "@/lib/utils";

export type BlockDraft = {
  id?: string;
  title: string;
  starts_at: string;
  ends_at: string;
  task_id: string | null;
  notes: string | null;
  editable: boolean;
};

type BlockPanelProps = {
  draft: BlockDraft | null;
  onClose: () => void;
  timezone: string;
  openTasks: SchedulableTask[];
  blocks: CalendarBlock[];
  /** Google events, for overlap warnings. */
  busy: ExternalEvent[];
  syncStates: Record<string, BlockSyncState>;
  onChanged: () => void;
};

const SYNC_LABEL: Record<BlockSyncState, string> = {
  synced: "In Google Calendar",
  pending: "Waiting to sync to Google Calendar",
  error: "Google Calendar sync failed; it will be retried",
};

/** Create or edit a time block. Also the keyboard-accessible alternative to drag and drop. */
export function BlockPanel({ draft, onClose, ...rest }: BlockPanelProps) {
  return (
    <Dialog.Root open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background p-5 shadow-xl">
          {draft && (
            <BlockForm
              key={draft.id ?? `${draft.starts_at}-${draft.task_id}`}
              draft={draft}
              onClose={onClose}
              {...rest}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function BlockForm({
  draft,
  onClose,
  timezone,
  openTasks,
  blocks,
  busy,
  syncStates,
  onChanged,
}: BlockPanelProps & { draft: BlockDraft }) {
  const id = useId();
  const start = instantToLocal(draft.starts_at, timezone);
  const end = instantToLocal(draft.ends_at, timezone);
  const [title, setTitle] = useState(draft.title);
  const [taskId, setTaskId] = useState(draft.task_id ?? "");
  const [date, setDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endTime, setEndTime] = useState(end.time);
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const readOnly = !draft.editable;

  // An end time at or before the start means the block ends the next day.
  const span = useMemo(() => {
    try {
      const startsAt = localToInstant(date, startTime, timezone);
      const endDate = endTime <= startTime ? addDays(date, 1) : date;
      return { starts_at: startsAt, ends_at: localToInstant(endDate, endTime, timezone) };
    } catch {
      return null;
    }
  }, [date, startTime, endTime, timezone]);

  const busySpans = busy
    .filter((e) => !e.allDay && !e.free)
    .map((e) => ({ id: `google-${e.id}`, title: e.title, starts_at: e.start, ends_at: e.end }));
  const overlaps = span ? overlapsWith({ ...span, id: draft.id }, [...blocks, ...busySpans]) : [];
  const syncState = draft.id ? syncStates[draft.id] : undefined;
  const linkedTask = openTasks.find((t) => t.id === taskId);
  const effectiveTitle = title.trim() || linkedTask?.title || "";

  const save = () => {
    if (!span) {
      setError("Enter a valid date and times.");
      return;
    }
    startTransition(async () => {
      const input = {
        title: effectiveTitle,
        notes: notes.trim() || null,
        ...span,
        task_id: taskId || null,
      };
      const result = draft.id ? await updateBlock(draft.id, input) : await createBlock(input);
      if (!result.ok) {
        setError(
          result.fieldErrors?.title?.[0] ?? result.fieldErrors?.ends_at?.[0] ?? result.error,
        );
        return;
      }
      toast.success(draft.id ? "Block updated" : "Block added");
      onChanged();
      if (result.data.overlaps.length) {
        toast.warning(`Overlaps with ${result.data.overlaps.map((o) => o.title).join(", ")}`);
      }
      onClose();
    });
  };

  const remove = () =>
    startTransition(async () => {
      if (!draft.id) return;
      const result = await deleteBlock(draft.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Block deleted");
      onChanged();
      onClose();
    });

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Dialog.Title className="text-base font-semibold">
          {readOnly ? "Calendar event" : draft.id ? "Edit time block" : "New time block"}
        </Dialog.Title>
        <Dialog.Close asChild>
          <button
            type="button"
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-surface-muted"
          >
            <X aria-hidden className="size-4" />
          </button>
        </Dialog.Close>
      </div>
      <Dialog.Description className="mt-1 text-sm text-muted-foreground">
        {readOnly
          ? "Imported from another calendar. Read-only here."
          : "Scheduled time to work. It doesn't change any task's deadline."}
      </Dialog.Description>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="space-y-1">
          <label htmlFor={`${id}-task`} className="block text-sm font-medium">
            Task (optional)
          </label>
          <select
            id={`${id}-task`}
            value={taskId}
            disabled={readOnly}
            onChange={(e) => setTaskId(e.target.value)}
            className={controlClass}
          >
            <option value="">No linked task</option>
            {draft.task_id && !openTasks.some((t) => t.id === draft.task_id) && (
              <option value={draft.task_id}>{draft.title} (finished)</option>
            )}
            {openTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-title`} className="block text-sm font-medium">
            Title
          </label>
          <input
            id={`${id}-title`}
            value={title}
            maxLength={200}
            readOnly={readOnly}
            placeholder={linkedTask?.title ?? "Focus time, meeting, errand…"}
            onChange={(e) => setTitle(e.target.value)}
            className={controlClass}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 space-y-1 sm:col-span-1">
            <label htmlFor={`${id}-date`} className="block text-sm font-medium">
              Date
            </label>
            <input
              id={`${id}-date`}
              type="date"
              value={date}
              readOnly={readOnly}
              onChange={(e) => setDate(e.target.value)}
              className={controlClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-start`} className="block text-sm font-medium">
              Start
            </label>
            <input
              id={`${id}-start`}
              type="time"
              step={300}
              value={startTime}
              readOnly={readOnly}
              onChange={(e) => setStartTime(e.target.value)}
              className={controlClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-end`} className="block text-sm font-medium">
              End
            </label>
            <input
              id={`${id}-end`}
              type="time"
              step={300}
              value={endTime}
              readOnly={readOnly}
              onChange={(e) => setEndTime(e.target.value)}
              className={controlClass}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {span ? formatTimeRange(span.starts_at, span.ends_at, timezone) : "—"} · {timezone}
        </p>
        {syncState && (
          <p
            className={cn(
              "text-xs",
              syncState === "error"
                ? "text-amber-800 dark:text-amber-300"
                : "text-muted-foreground",
            )}
          >
            {SYNC_LABEL[syncState]}
          </p>
        )}

        {overlaps.length > 0 && (
          <p
            role="status"
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Overlaps with {overlaps.map((o) => o.title).join(", ")}. You can still save it.
            </span>
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor={`${id}-notes`} className="block text-sm font-medium">
            Notes (optional)
          </label>
          <textarea
            id={`${id}-notes`}
            value={notes}
            rows={3}
            maxLength={5000}
            readOnly={readOnly}
            onChange={(e) => setNotes(e.target.value)}
            className={controlClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        {!readOnly && (
          <div className="flex items-center justify-between gap-2 pt-2">
            {draft.id ? (
              <Button
                variant="ghost"
                className={cn(confirmDelete && "text-red-700 dark:text-red-400")}
                disabled={pending}
                onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
              >
                {confirmDelete ? "Confirm delete" : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Dialog.Close>
              <Button type="submit" disabled={pending || !effectiveTitle}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </form>
    </>
  );
}
