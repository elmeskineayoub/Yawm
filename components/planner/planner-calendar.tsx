"use client";

import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  type EventReceiveArg,
  type EventResizeDoneArg,
} from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import luxon3Plugin from "@fullcalendar/luxon3";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { moveBlock, scheduleTask } from "@/features/calendar/actions";
import { overlappingIds } from "@/features/calendar/logic";
import type { CalendarBlock, DeadlineMarker } from "@/features/calendar/queries";
import type { IsoDate } from "@/lib/dates";
import { localToInstant } from "@/lib/dates/zoned";
import type { BlockDraft } from "./block-panel";

export type CalendarMode = "grid" | "agenda";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon 12" (FullCalendar's en-US default would be "12 Mon"). */
const weekHeader = ({ date }: { date: { year: number; month: number; day: number } }) =>
  `${WEEKDAY[new Date(Date.UTC(date.year, date.month, date.day)).getUTCDay()]} ${date.day}`;

const VIEW_NAMES = {
  day: { grid: "timeGridDay", agenda: "listDay" },
  week: { grid: "timeGridWeek", agenda: "listWeek" },
  month: { grid: "dayGridMonth", agenda: "listMonth" },
} as const;

type PlannerCalendarProps = {
  view: "day" | "week" | "month";
  mode: CalendarMode;
  start: IsoDate;
  timezone: string;
  weekStart: number;
  blocks: CalendarBlock[];
  deadlines: DeadlineMarker[];
  onOpenBlock: (draft: BlockDraft) => void;
  onSaving: (state: "saving" | "saved" | "error") => void;
};

/**
 * The Planner's calendar. Times are shown in the user's profile timezone (via the Luxon plugin),
 * not the browser's. Deadlines appear in the all-day "Due" row, separate from scheduled blocks.
 * Every drag interaction has a keyboard alternative through the block panel.
 */
export default function PlannerCalendar({
  view,
  mode,
  start,
  timezone,
  weekStart,
  blocks,
  deadlines,
  onOpenBlock,
  onSaving,
}: PlannerCalendarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const events = useMemo<EventInput[]>(() => {
    const overlapping = overlappingIds(blocks);
    return [
      ...blocks.map((b) => ({
        id: b.id,
        title: b.title,
        start: b.starts_at,
        end: b.ends_at,
        editable: b.editable,
        classNames: [
          "planner-block",
          overlapping.has(b.id) ? "planner-block-overlap" : "",
          b.task?.status === "done" ? "planner-block-done" : "",
          b.editable ? "" : "planner-block-external",
        ].filter(Boolean),
        extendedProps: { kind: "block", block: b, overlap: overlapping.has(b.id) },
      })),
      ...deadlines.map((d) => ({
        id: `due-${d.id}`,
        title: d.title,
        start: d.due_date,
        allDay: true,
        editable: false,
        classNames: ["planner-deadline", d.status === "done" ? "planner-deadline-done" : ""],
        extendedProps: { kind: "deadline", taskId: d.id },
      })),
    ];
  }, [blocks, deadlines]);

  const run = (
    work: () => Promise<{ ok: boolean; error?: string; data?: { overlaps?: { title: string }[] } }>,
    revert?: () => void,
  ) => {
    onSaving("saving");
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        onSaving("saved");
        const overlaps = result.data?.overlaps ?? [];
        if (overlaps.length)
          toast.warning(`Overlaps with ${overlaps.map((o) => o.title).join(", ")}`);
        router.refresh();
      } else {
        onSaving("error");
        revert?.();
        toast.error(result.error ?? "Could not save. Your change was undone.");
      }
    });
  };

  /** Clicking or dragging over empty time opens the panel to create a block there. */
  const onSelect = (info: DateSelectArg) => {
    info.view.calendar.unselect();
    if (info.allDay) {
      // From the month grid: suggest 09:00–10:00 on that day.
      const date = info.startStr.slice(0, 10);
      onOpenBlock({
        title: "",
        starts_at: localToInstant(date, "09:00", timezone),
        ends_at: localToInstant(date, "10:00", timezone),
        task_id: null,
        notes: null,
        editable: true,
      });
      return;
    }
    onOpenBlock({
      title: "",
      starts_at: info.startStr,
      ends_at: info.endStr,
      task_id: null,
      notes: null,
      editable: true,
    });
  };

  const onMove = (info: EventDropArg | EventResizeDoneArg) => {
    const { event } = info;
    if (!event.startStr || !event.endStr || event.allDay) {
      info.revert();
      toast.error("Time blocks need a start and end time.");
      return;
    }
    setPendingIds((ids) => new Set(ids).add(event.id));
    run(
      () => moveBlock(event.id, event.startStr, event.endStr),
      () => info.revert(),
    );
  };

  /** A task dropped from the Unscheduled tray becomes a block linked to that task. */
  const onReceive = (info: EventReceiveArg) => {
    const { event } = info;
    const taskId = event.extendedProps.taskId as string | undefined;
    let startsAt = event.startStr;
    let endsAt = event.endStr;
    if (event.allDay || !endsAt) {
      const date = event.startStr.slice(0, 10);
      startsAt = localToInstant(date, "09:00", timezone);
      endsAt = new Date(Date.parse(startsAt) + 30 * 60_000).toISOString();
    }
    // The server's copy replaces this placeholder after the refresh.
    event.remove();
    if (!taskId) return;
    run(() => scheduleTask(taskId, startsAt, endsAt));
  };

  const onClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    const { kind } = info.event.extendedProps;
    if (kind === "deadline") {
      router.push(`/tasks/${info.event.extendedProps.taskId}`);
      return;
    }
    const block = info.event.extendedProps.block as CalendarBlock;
    onOpenBlock({
      id: block.id,
      title: block.title,
      starts_at: block.starts_at,
      ends_at: block.ends_at,
      task_id: block.task_id,
      notes: block.notes,
      editable: block.editable,
    });
  };

  const renderEvent = (arg: EventContentArg) => {
    const { kind, overlap } = arg.event.extendedProps;
    if (kind === "deadline") {
      return (
        <span className="planner-deadline-label" title={`Deadline: ${arg.event.title}`}>
          <span aria-hidden>◆ </span>
          <span className="sr-only">Deadline: </span>
          {arg.event.title}
        </span>
      );
    }
    return (
      <span className="planner-block-label">
        {arg.timeText && <span className="planner-block-time">{arg.timeText}</span>}
        <span className="planner-block-title">{arg.event.title}</span>
        {overlap && <span className="sr-only"> (overlaps another block)</span>}
        {pendingIds.has(arg.event.id) && <span className="sr-only"> (saving)</span>}
      </span>
    );
  };

  return (
    <FullCalendar
      key={`${view}-${mode}-${start}-${timezone}`}
      plugins={[luxon3Plugin, dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
      initialView={VIEW_NAMES[view][mode]}
      initialDate={start}
      timeZone={timezone}
      firstDay={weekStart}
      headerToolbar={false}
      height={view === "month" || mode === "agenda" ? "auto" : 640}
      expandRows
      nowIndicator
      allDayText="Due"
      dayHeaderFormat={view === "week" ? weekHeader : { weekday: "short" }}
      allDaySlot
      slotDuration="00:30:00"
      snapDuration="00:15:00"
      scrollTime="07:00:00"
      scrollTimeReset={false}
      slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      dayMaxEvents={4}
      editable
      eventStartEditable
      eventDurationEditable
      selectable
      selectMirror
      droppable
      // Deadlines live in the all-day row; blocks are timed. Keep timed blocks out of it.
      eventAllow={(dropInfo) => !dropInfo.allDay || view === "month"}
      events={events}
      select={onSelect}
      eventDrop={onMove}
      eventResize={onMove}
      eventReceive={onReceive}
      eventClick={onClick}
      eventContent={renderEvent}
      noEventsContent="Nothing scheduled. Click a time slot to add a block."
    />
  );
}
