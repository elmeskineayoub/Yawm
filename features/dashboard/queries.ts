import type { FocusPhase } from "@/features/focus/logic";
import { loadHabitRatesForRange, type HabitRangeRate } from "@/features/habits/queries";
import { aggregateHabitRates, type WeekHabitSummary } from "@/features/reviews/logic";
import { addDays, dateOfInstant, periodStart, type IsoDate } from "@/lib/dates";
import { zonedRange } from "@/lib/dates/zoned";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { bucketByDay, completionRate, sumByDay, type DayCount, type DaySeconds } from "./logic";
import { parseDashboardPrefs, type DashboardSection } from "./sections";

export type DashboardInsights = {
  /** Tasks completed per day over the last 7 days (oldest first), in the user's timezone. */
  trend: DayCount[];
  /** Total completed in the trend window. */
  trendTotal: number;
  weekStart: IsoDate;
  weekCompleted: number;
  /** Open tasks whose deadline fell in the current week. */
  weekOpenDue: number;
  /** done / (done + open due) for the week, as a percentage, or null when nothing applies. */
  weekTaskRate: number | null;
  habits: WeekHabitSummary;
  /** Focus-session seconds per day of the current week (week start first), in the user's timezone. */
  focusByDay: DaySeconds[];
};

const TREND_DAYS = 7;

/** The raw rows the insights are derived from (what the queries below return). */
export type InsightRows = {
  /** completed_at of done tasks in the trend window. */
  recentCompletions: (string | null)[];
  weekCompleted: number;
  weekOpenDue: number;
  habitRates: HabitRangeRate[];
  /** Sessions started in the current week. */
  weekSessions: { session_type: FocusPhase; duration_seconds: number; started_at: string }[];
};

/**
 * Pure: shapes the dashboard's insights from source rows, so every figure is derived from records
 * (and the design fixture runs through the same code as the live page).
 */
export function deriveInsights(
  rows: InsightRows,
  { today, timezone, weekStart }: { today: IsoDate; timezone: string; weekStart: number },
): DashboardInsights {
  const trendStart = addDays(today, -(TREND_DAYS - 1));
  const weekStartDate = periodStart("week", today, weekStart);
  const localDates = rows.recentCompletions
    .filter((at): at is string => Boolean(at))
    .map((at) => dateOfInstant(at, timezone));
  const trend = bucketByDay(localDates, trendStart, TREND_DAYS);
  const focusByDay = sumByDay(
    rows.weekSessions
      .filter((s) => s.session_type === "focus")
      .map((s) => ({ date: dateOfInstant(s.started_at, timezone), seconds: s.duration_seconds })),
    weekStartDate,
    7,
  );
  return {
    trend,
    trendTotal: trend.reduce((sum, d) => sum + d.count, 0),
    weekStart: weekStartDate,
    weekCompleted: rows.weekCompleted,
    weekOpenDue: rows.weekOpenDue,
    weekTaskRate: completionRate(rows.weekCompleted, rows.weekOpenDue),
    habits: aggregateHabitRates(rows.habitRates),
    focusByDay,
  };
}

/** Trends, weekly task completion, habit completion, and focus per day for the dashboard. */
export async function loadDashboardInsights(ctx: WorkspaceContext): Promise<DashboardInsights> {
  const { supabase, workspace, timezone, today, weekStart } = ctx;
  const trendStart = addDays(today, -(TREND_DAYS - 1));
  const trendRange = zonedRange(trendStart, addDays(today, 1), timezone);
  const weekStartDate = periodStart("week", today, weekStart);
  const weekEnd = addDays(weekStartDate, 6);
  const weekRange = zonedRange(weekStartDate, addDays(weekStartDate, 7), timezone);

  const [recent, weekDone, weekOpen, habitRates, sessions] = await Promise.all([
    supabase
      .from("tasks")
      .select("completed_at")
      .eq("workspace_id", workspace.id)
      .eq("status", "done")
      .gte("completed_at", trendRange.start)
      .lt("completed_at", trendRange.end)
      .limit(2000),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "done")
      .gte("completed_at", weekRange.start)
      .lt("completed_at", weekRange.end),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .in("status", ["todo", "in_progress"])
      .gte("due_date", weekStartDate)
      .lte("due_date", weekEnd),
    loadHabitRatesForRange(ctx, weekStartDate, weekEnd),
    supabase
      .from("focus_sessions")
      .select("session_type, duration_seconds, started_at")
      .eq("workspace_id", workspace.id)
      .eq("session_type", "focus")
      .gte("started_at", weekRange.start)
      .lt("started_at", weekRange.end)
      .limit(5000),
  ]);
  if (recent.error || weekDone.error || weekOpen.error || sessions.error) {
    throw new Error("Could not load dashboard insights.");
  }

  return deriveInsights(
    {
      recentCompletions: recent.data.map((t) => t.completed_at),
      weekCompleted: weekDone.count ?? 0,
      weekOpenDue: weekOpen.count ?? 0,
      habitRates,
      weekSessions: sessions.data,
    },
    { today, timezone, weekStart },
  );
}

/**
 * Which sections the user hid. Loaded on its own so that, if the column is missing (migration
 * 20261106090000 not applied yet), the Dashboard still renders every section and customizing is
 * reported as unavailable instead of breaking the page.
 */
export async function loadDashboardPrefs(
  ctx: WorkspaceContext,
): Promise<{ hidden: Set<DashboardSection>; available: boolean }> {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("dashboard_prefs")
    .eq("id", ctx.user.id)
    .maybeSingle();
  if (error) return { hidden: new Set(), available: false };
  return { hidden: parseDashboardPrefs(data?.dashboard_prefs), available: true };
}
