"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ExternalEvent } from "@/features/google-calendar/types";
import { addDays } from "@/lib/dates";
import { formatTimeRange, instantToLocal } from "@/lib/dates/zoned";

function describeWhen(event: ExternalEvent, timezone: string) {
  if (event.allDay) {
    const last = addDays(event.end, -1);
    return last > event.start ? `All day, ${event.start} – ${last}` : `All day, ${event.start}`;
  }
  return `${instantToLocal(event.start, timezone).date}, ${formatTimeRange(event.start, event.end, timezone)}`;
}

/** Details of a Google event. Read-only: v1 never writes back to events it didn't create. */
export function ExternalEventPanel({
  event,
  timezone,
  onClose,
}: {
  event: ExternalEvent | null;
  timezone: string;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background p-5 shadow-xl">
          {event && (
            <>
              <div className="flex items-start justify-between gap-2">
                <Dialog.Title className="text-base font-semibold break-words">
                  {event.title}
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
                From Google Calendar. Read-only here; change it in Google Calendar.
              </Dialog.Description>
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">When</dt>
                  <dd>
                    {describeWhen(event, timezone)}
                    {!event.allDay && <span className="text-muted-foreground"> · {timezone}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Calendar</dt>
                  <dd className="break-all">{event.calendarName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Shows as</dt>
                  <dd>{event.free ? "Free" : "Busy"}</dd>
                </div>
              </dl>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
