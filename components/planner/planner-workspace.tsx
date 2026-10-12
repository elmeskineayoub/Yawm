"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { CalendarBlock, DeadlineMarker, SchedulableTask } from "@/features/calendar/queries";
import { defaultBlockMinutes } from "@/features/calendar/logic";
import type { IsoDate } from "@/lib/dates";
import { localToInstant } from "@/lib/dates/zoned";
import { cn } from "@/lib/utils";
import { BlockPanel, type BlockDraft } from "./block-panel";
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-label="Calendar" className="order-2 min-w-0 lg:order-1">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Calendar display"
            className="flex rounded-md border border-border p-0.5 text-xs"
          >
            {(["grid", "agenda"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setChosenMode(m)}
                className={cn(
                  "rounded px-2.5 py-1",
                  mode === m ? "bg-surface-muted font-medium" : "text-muted-foreground",
                )}
              >
                {m === "grid" ? (view === "month" ? "Month grid" : "Timeline") : "Agenda"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span
              role="status"
              aria-live="polite"
              className={cn(saving === "error" && "text-red-700 dark:text-red-400")}
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
        {browserTz && browserTz !== timezone && (
          <p className="mb-2 text-xs text-muted-foreground">
            Times are shown in {timezone} (your profile timezone). This device is set to {browserTz}
            . You can change your timezone in Settings.
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
            onOpenBlock={setDraft}
            onSaving={setSaving}
          />
        </div>
      </section>

      <aside aria-label="Plan" className="order-1 space-y-6 lg:order-2">
        {props.focus}
        <RescheduleList items={props.reschedule} today={today} onSchedule={scheduleTask} />
        <UnscheduledTray
          tasks={props.unscheduled}
          priorityIds={priorityIds}
          today={today}
          onSchedule={scheduleTask}
        />
      </aside>

      <BlockPanel
        draft={draft}
        onClose={() => setDraft(null)}
        timezone={timezone}
        openTasks={props.openTasks}
        blocks={props.blocks}
      />
    </div>
  );
}
