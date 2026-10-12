import { visibleDates, needsRescheduling, unscheduledTasks } from "@/features/calendar/logic";
import {
  loadBlocks,
  loadDeadlines,
  loadSchedulingState,
  type CalendarBlock,
  type DeadlineMarker,
  type SchedulableTask,
} from "@/features/calendar/queries";
import { loadGoogleEvents, loadGoogleOverview } from "@/features/google-calendar/queries";
import type {
  BlockSyncState,
  ExternalEvent,
  GoogleConnectionState,
} from "@/features/google-calendar/types";
import { loadLookups } from "@/features/tasks/queries";
import { PARENT_PERIOD, periodEnd, periodStart, type IsoDate, type PlanPeriod } from "@/lib/dates";
import { zonedRange } from "@/lib/dates/zoned";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { loadPlanPage, type PlanPageData } from "./queries";

export type ContextPeriod = { period: PlanPeriod; start: IsoDate; theme: string | null };

export type PlannerData = PlanPageData & {
  /** Enclosing periods (e.g. a day's week, month, and year), worked out from dates. */
  context: ContextPeriod[];
  calendar: {
    blocks: CalendarBlock[];
    deadlines: DeadlineMarker[];
    /** Open tasks without upcoming scheduled time; this period's priorities first. */
    unscheduled: SchedulableTask[];
    /** Open tasks for the block editor's "linked task" picker. */
    openTasks: SchedulableTask[];
    reschedule: { task: SchedulableTask; reasons: ("missed_block" | "overdue")[] }[];
    google: {
      state: GoogleConnectionState;
      /** Sync state of the visible blocks; absent when a block isn't synced to Google. */
      blockStates: Record<string, BlockSyncState>;
      /** Read-only Google events in the visible range. */
      events: ExternalEvent[];
      eventsError: string | null;
    };
  } | null;
};

/** Every enclosing period, nearest first. No parent plan has to exist. */
function enclosingPeriods(period: PlanPeriod, start: IsoDate, weekStart: number) {
  const result: { period: PlanPeriod; start: IsoDate }[] = [];
  let current = PARENT_PERIOD[period];
  while (current) {
    result.push({ period: current, start: periodStart(current, start, weekStart) });
    current = PARENT_PERIOD[current];
  }
  return result;
}

export async function loadPlanner(
  ctx: WorkspaceContext,
  period: PlanPeriod,
  start: IsoDate,
  now: Date = new Date(),
): Promise<PlannerData> {
  const { supabase, workspace, weekStart, timezone, today } = ctx;
  const lookups = await loadLookups(ctx);
  const enclosing = enclosingPeriods(period, start, weekStart);

  const [planData, contextPlans] = await Promise.all([
    loadPlanPage(ctx, period, start, PARENT_PERIOD[period], lookups),
    enclosing.length
      ? supabase
          .from("plans")
          .select("period, period_start, theme")
          .eq("workspace_id", workspace.id)
          .in(
            "period",
            enclosing.map((e) => e.period),
          )
          .in(
            "period_start",
            enclosing.map((e) => e.start),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  const context = enclosing.map((e) => ({
    ...e,
    theme:
      (contextPlans.data ?? []).find((p) => p.period === e.period && p.period_start === e.start)
        ?.theme ?? null,
  }));

  if (period === "year") return { ...planData, context, calendar: null };

  const visible = visibleDates(period, start, weekStart);
  const range = zonedRange(visible.from, visible.to, timezone);
  const [blocks, deadlines, scheduling, google] = await Promise.all([
    loadBlocks(ctx, range),
    loadDeadlines(ctx, visible),
    loadSchedulingState(ctx),
    loadGoogleOverview(ctx).then(async (overview) => ({
      overview,
      ...(await loadGoogleEvents(overview, range)),
    })),
  ]);

  const priorityIds = new Set(
    planData.items.flatMap((i) => (i.kind === "task" ? [i.task.id] : [])),
  );
  const unscheduled = unscheduledTasks(scheduling.tasks, scheduling.blocks, now).sort(
    (a, b) => Number(priorityIds.has(b.id)) - Number(priorityIds.has(a.id)),
  );
  // "Needs rescheduling" belongs to the day or week that contains today.
  const containsToday = period !== "month" && today >= start && today < periodEnd(period, start);
  const reschedule = containsToday
    ? needsRescheduling(scheduling.tasks, scheduling.blocks, now, today)
    : [];
  const needsDecision = new Set(reschedule.map((r) => r.task.id));

  return {
    ...planData,
    context,
    calendar: {
      blocks,
      deadlines,
      // Tasks awaiting a rescheduling decision are listed there, not twice.
      unscheduled: unscheduled.filter((t) => !needsDecision.has(t.id)),
      openTasks: scheduling.tasks,
      reschedule,
      google: {
        state: google.overview.state,
        blockStates: Object.fromEntries(
          blocks.flatMap((b) => {
            const state = google.overview.blockStates.get(b.id);
            return state ? [[b.id, state]] : [];
          }),
        ),
        events: google.events,
        eventsError: google.error,
      },
    },
  };
}
