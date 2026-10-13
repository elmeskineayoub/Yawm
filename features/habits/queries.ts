import { addDays, periodStart, type IsoDate } from "@/lib/dates";
import type { WorkspaceContext } from "@/lib/workspace-context";
import {
  completionRate,
  dayStatus,
  isDueOn,
  streaks,
  weekProgress,
  type CompletionRate,
  type DayStatus,
  type HabitLog,
  type HabitRule,
  type Streaks,
  type WeekProgress,
} from "./logic";

export type Habit = HabitRule & {
  id: string;
  title: string;
  description: string | null;
  area_id: string | null;
  unit: string | null;
  archived_at: string | null;
  sort_order: number;
};

const habitColumns =
  "id, title, description, area_id, kind, target_value, unit, frequency, weekdays, times_per_week, starts_on, ends_on, archived_at, sort_order";

/** Streaks look back at most this far, which keeps queries bounded. */
const HISTORY_DAYS = 3 * 366;
const PAGE = 1000;

/** Logs for these habits since `since`, paged past PostgREST's row limit. */
async function loadLogs(
  { supabase, workspace }: WorkspaceContext,
  habitIds: string[],
  since: IsoDate,
): Promise<Map<string, HabitLog[]>> {
  const byHabit = new Map<string, HabitLog[]>(habitIds.map((id) => [id, []]));
  if (!habitIds.length) return byHabit;
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("habit_logs")
      .select("habit_id, log_date, value, rest")
      .eq("workspace_id", workspace.id)
      .in("habit_id", habitIds)
      .gte("log_date", since)
      .order("log_date")
      .order("habit_id")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error("Could not load habit history.");
    for (const row of data) {
      byHabit.get(row.habit_id)?.push({
        log_date: row.log_date,
        value: row.value === null ? null : Number(row.value),
        rest: row.rest,
      });
    }
    if (data.length < PAGE) break;
  }
  return byHabit;
}

function toHabit(row: Record<string, unknown>): Habit {
  const h = row as Habit;
  return { ...h, target_value: h.target_value === null ? null : Number(h.target_value) };
}

export type HabitSummary = {
  habit: Habit;
  streaks: Streaks;
  /** Last 7 days ending on `date`, oldest first. */
  recent: { date: IsoDate; status: DayStatus }[];
  /** The log for `date`, if any. */
  log: HabitLog | null;
  /** Whether the habit is due on `date` (weekly: until the week's target is met). */
  due: boolean;
  /** Weekly habits: progress in the week containing `date`. */
  week: WeekProgress | null;
};

function summarize(
  habit: Habit,
  logs: HabitLog[],
  date: IsoDate,
  today: IsoDate,
  weekStart: number,
): HabitSummary {
  const byDate = new Map(logs.map((l) => [l.log_date, l]));
  return {
    habit,
    streaks: streaks(habit, logs, today, weekStart),
    recent: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(date, i - 6);
      return { date: d, status: dayStatus(habit, d, byDate.get(d), today) };
    }),
    log: byDate.get(date) ?? null,
    due: isDueOn(habit, logs, date, weekStart),
    week:
      habit.frequency === "weekly"
        ? weekProgress(habit, periodStart("week", date, weekStart), byDate, today)
        : null,
  };
}

/** Habits with streaks and their state on `date` (default today). */
export async function loadHabitSummaries(
  ctx: WorkspaceContext,
  { date = ctx.today, archived = false }: { date?: IsoDate; archived?: boolean } = {},
): Promise<HabitSummary[]> {
  const query = ctx.supabase
    .from("habits")
    .select(habitColumns)
    .eq("workspace_id", ctx.workspace.id)
    .order("sort_order")
    .order("created_at");
  const { data, error } = await (archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null));
  if (error) throw new Error("Could not load your habits.");
  const habits = data.map(toHabit);
  const logs = await loadLogs(
    ctx,
    habits.map((h) => h.id),
    addDays(ctx.today, -HISTORY_DAYS),
  );
  return habits.map((h) => summarize(h, logs.get(h.id) ?? [], date, ctx.today, ctx.weekStart));
}

/** Habits that apply to `date`: scheduled that day and active (for the Planner, Today, Dashboard). */
export async function loadHabitsForDay(ctx: WorkspaceContext, date: IsoDate) {
  const all = await loadHabitSummaries(ctx, { date });
  return all.filter((s) => s.due);
}

export type HabitRangeRate = { id: string; title: string } & CompletionRate;

/**
 * Completion rate per active habit over [from, to] (inclusive), counting only scheduled days (the
 * weekly review's habit statistics). Rest days and open days are excluded by `completionRate`.
 */
export async function loadHabitRatesForRange(
  ctx: WorkspaceContext,
  from: IsoDate,
  to: IsoDate,
): Promise<HabitRangeRate[]> {
  const { data, error } = await ctx.supabase
    .from("habits")
    .select(habitColumns)
    .eq("workspace_id", ctx.workspace.id)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error("Could not load your habits.");
  const habits = data.map(toHabit);
  // Weekly habits need their whole week's logs; widen the lower bound to that week's start.
  const logs = await loadLogs(
    ctx,
    habits.map((h) => h.id),
    periodStart("week", from, ctx.weekStart),
  );
  return habits.map((h) => ({
    id: h.id,
    title: h.title,
    ...completionRate(h, logs.get(h.id) ?? [], from, to, ctx.today, ctx.weekStart),
  }));
}

export type HabitDetail = HabitSummary & {
  logs: HabitLog[];
  rates: { week: CompletionRate; month: CompletionRate; last30: CompletionRate };
};

export async function loadHabitDetail(
  ctx: WorkspaceContext,
  habitId: string,
): Promise<HabitDetail | null> {
  const { data, error } = await ctx.supabase
    .from("habits")
    .select(habitColumns)
    .eq("workspace_id", ctx.workspace.id)
    .eq("id", habitId)
    .maybeSingle();
  if (error) throw new Error("Could not load the habit.");
  if (!data) return null;
  const habit = toHabit(data);
  const logs =
    (await loadLogs(ctx, [habit.id], addDays(ctx.today, -HISTORY_DAYS))).get(habit.id) ?? [];
  const { today, weekStart } = ctx;
  const weekFrom = periodStart("week", today, weekStart);
  const monthFrom = periodStart("month", today);
  return {
    ...summarize(habit, logs, today, today, weekStart),
    logs,
    rates: {
      week: completionRate(habit, logs, weekFrom, addDays(weekFrom, 6), today, weekStart),
      month: completionRate(habit, logs, monthFrom, today, today, weekStart),
      last30: completionRate(habit, logs, addDays(today, -29), today, today, weekStart),
    },
  };
}
