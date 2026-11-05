"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { CalendarBlock, DeadlineMarker, SchedulableTask } from "@/features/calendar/queries";
import { defaultBlockMinutes } from "@/features/calendar/logic";
import type {
  BlockSyncState,
  ExternalEvent,
  GoogleConnectionState,
} from "@/features/google-calendar/types";
import type { IsoDate } from "@/lib/dates";
import { localToInstant } from "@/lib/dates/zoned";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import { BlockPanel, type BlockDraft } from "./block-panel";
import { ExternalEventPanel } from "./external-event-panel";
import { GoogleSyncStatus, useGoogleSync } from "./google-sync";
import type { CalendarMode } from "./planner-calendar";
import { RescheduleList, UnscheduledTray } from "./schedule-lists";

const PlannerCalendar = dynamic(() => import("./planner-calendar"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Loading calendar"
      className="h-[640px] animate-pulse rounded-lg bg-surface-muted"
    />
  ),
});

type PlannerWorkspaceProps = {
  view: "day" | "week" | "month";
  start: IsoDate;
  today: IsoDate;
  timezone: string;
  weekStart: number;
  blocks: CalendarBlock[];
  deadlines: DeadlineMarker[];
  unscheduled: SchedulableTask[];
  openTasks: SchedulableTask[];
  reschedule: { task: SchedulableTask; reasons: ("missed_block" | "overdue")[] }[];
  priorityIds: string[];
  google: {
    state: GoogleConnectionState;
    blockStates: Record<string, BlockSyncState>;
    events: ExternalEvent[];
    eventsError: string | null;
  };
  /** Server-rendered intention and priorities, shown above the scheduling tools. */
  focus: ReactNode;
};

const subscribeNarrow = (onChange: () => void) => {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getNarrow = () => window.matchMedia("(max-width: 767px)").matches;

function useBrowserTimezone() {
  return useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

/** Next half hour from now on `date` if it is today, otherwise 09:00 on `date`. */
function suggestedStart(date: IsoDate, today: IsoDate, timezone: string): string {
  if (date !== today) return localToInstant(date, "09:00", timezone);
  const now = Date.now();
  const half = 30 * 60_000;
  return new Date(Math.ceil(now / half) * half).toISOString();
}

export function PlannerWorkspace(props: PlannerWorkspaceProps) {
  const { view, start, today, timezone } = props;
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, () => false);
  const [chosenMode, setChosenMode] = useState<CalendarMode | null>(null);
  // Phones get the agenda for week and month by default; the grid is still one tap away.
  const mode: CalendarMode = chosenMode ?? (narrow && view !== "day" ? "agenda" : "grid");
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [external, setExternal] = useState<ExternalEvent | null>(null);
  const google = useGoogleSync(props.google.state);
  const onChanged = () => void google.run();
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const browserTz = useBrowserTimezone();
  const priorityIds = new Set(props.priorityIds);

  const scheduleTask = (task: SchedulableTask) => {
    const date = today >= start && view !== "month" ? today : start;
    const startsAt = suggestedStart(date, today, timezone);
    const minutes = defaultBlockMinutes(task.estimate_minutes);
    setDraft({
      title: task.title,
      starts_at: startsAt,
      ends_at: new Date(Date.parse(startsAt) + minutes * 60_000).toISOString(),
      task_id: task.id,
      notes: null,
      editable: true,
    });
  };

  return (
    // Below lg: plan, then calendar, then the scheduling lists (so the calendar is not pushed below
    // long lists). From lg: calendar on the left; plan and lists stacked on the right.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
      <aside aria-label="Plan" className="order-1 min-w-0 lg:col-start-2 lg:row-start-1">
        {props.focus}
      </aside>
      <section
        aria-label="Calendar"
        className="order-2 min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            label="Calendar display"
            size="sm"
            value={mode}
            onChange={setChosenMode}
            items={(["grid", "agenda"] as const).map((m) => ({
              value: m,
              label: m === "grid" ? (view === "month" ? "Month grid" : "Timeline") : "Agenda",
            }))}
          />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <GoogleSyncStatus
              state={props.google.state}
              phase={google.phase}
              message={google.message}
              onRetry={() => void google.run(true)}
            />
            <span
              role="status"
              aria-live="polite"
              className={cn(saving === "error" && "text-danger")}
            >
              {saving === "saving"
                ? "Saving…"
                : saving === "saved"
                  ? "Saved"
                  : saving === "error"
                    ? "Not saved"
                    : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                const startsAt = suggestedStart(today >= start ? today : start, today, timezone);
                setDraft({
                  title: "",
                  starts_at: startsAt,
                  ends_at: new Date(Date.parse(startsAt) + 60 * 60_000).toISOString(),
                  task_id: null,
                  notes: null,
                  editable: true,
                });
              }}
              className="rounded-md border border-border px-2.5 py-1 text-foreground hover:bg-surface-muted"
            >
              + New block
            </button>
          </div>
        </div>
        <CalendarLegend google={props.google.state.available && props.google.state.connected} />
        {browserTz && browserTz !== timezone && (
          <p className="mb-2 text-xs text-muted-foreground">
            Times are shown in {timezone} (your profile timezone). This device is set to {browserTz}
            . You can change your timezone in Settings.
          </p>
        )}
        {props.google.eventsError && (
          <p role="alert" className="mb-2 text-xs text-warning">
            {props.google.eventsError}
          </p>
        )}
        <div className="planner-calendar">
          <PlannerCalendar
            view={view}
            mode={mode}
            start={start}
            timezone={timezone}
            weekStart={props.weekStart}
            blocks={props.blocks}
            deadlines={props.deadlines}
            external={props.google.events}
            onOpenBlock={setDraft}
            onOpenExternal={setExternal}
            onSaving={setSaving}
            onChanged={onChanged}
          />
        </div>
      </section>

      <div className="order-3 min-w-0 space-y-6 lg:col-start-2 lg:row-start-2 lg:self-start">
        <RescheduleList items={props.reschedule} today={today} onSchedule={scheduleTask} />
        <UnscheduledTray
          tasks={props.unscheduled}
          priorityIds={priorityIds}
          today={today}
          onSchedule={scheduleTask}
        />
      </div>

      <BlockPanel
        draft={draft}
        onClose={() => setDraft(null)}
        timezone={timezone}
        openTasks={props.openTasks}
        blocks={props.blocks}
        busy={props.google.events}
        syncStates={props.google.blockStates}
        onChanged={onChanged}
      />
      <ExternalEventPanel event={external} timezone={timezone} onClose={() => setExternal(null)} />
    </div>
  );
}

/**
 * What the calendar's marks mean. Scheduled time (when you plan to work) and deadlines (when it is
 * due) look deliberately different; Google events are read-only busy time.
 */
function CalendarLegend({ google }: { google: boolean }) {
  return (
    <ul
      aria-label="Calendar legend"
      className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-3 w-4 rounded-sm border-l-[3px] border-accent bg-accent/15"
        />
        Scheduled time
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-3 w-4 rounded-sm border border-dashed border-muted-foreground"
        />
        Deadline
      </li>
      {google && (
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-3 w-4 rounded-sm border-l-[3px] border-muted-foreground bg-surface-muted bg-[repeating-linear-gradient(135deg,transparent_0_3px,color-mix(in_srgb,var(--muted-foreground)_25%,transparent)_3px_6px)]"
          />
          Google Calendar (busy, read-only)
        </li>
      )}
    </ul>
  );
}
