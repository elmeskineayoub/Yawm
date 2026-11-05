"use client";

import { Sheet, SheetHeader } from "@/components/ui/sheet";
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
    <Sheet open={event !== null} onOpenChange={(open) => !open && onClose()}>
      {event && (
        <>
          <SheetHeader
            title={event.title}
            description="From Google Calendar. Read-only here; change it in Google Calendar."
          />
          <dl className="space-y-3 text-sm">
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
    </Sheet>
  );
}
