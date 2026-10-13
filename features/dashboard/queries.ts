import { loadHabitRatesForRange } from "@/features/habits/queries";
import { aggregateHabitRates, type WeekHabitSummary } from "@/features/reviews/logic";
import { addDays, dateOfInstant, periodStart, type IsoDate } from "@/lib/dates";
import { zonedRange } from "@/lib/dates/zoned";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { bucketByDay, completionRate, type DayCount } from "./logic";

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
};

const TREND_DAYS = 7;

/** Trends, weekly task completion, and habit completion for the dashboard. */
export async function loadDashboardInsights(ctx: WorkspaceContext): Promise<DashboardInsights> {
  const { supabase, workspace, timezone, today, weekStart } = ctx;
  const trendStart = addDays(today, -(TREND_DAYS - 1));
  const trendRange = zonedRange(trendStart, addDays(today, 1), timezone);
  const weekStartDate = periodStart("week", today, weekStart);
  const weekEnd = addDays(weekStartDate, 6);
  const weekRange = zonedRange(weekStartDate, addDays(weekStartDate, 7), timezone);

  const [recent, weekDone, weekOpen, habitRates] = await Promise.all([
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
  ]);
  if (recent.error || weekDone.error || weekOpen.error) {
    throw new Error("Could not load dashboard insights.");
  }

  const localDates = recent.data
    .filter((t) => t.completed_at)
    .map((t) => dateOfInstant(t.completed_at!, timezone));
  const trend = bucketByDay(localDates, trendStart, TREND_DAYS);
  const weekCompleted = weekDone.count ?? 0;
  const weekOpenDue = weekOpen.count ?? 0;

  return {
    trend,
    trendTotal: trend.reduce((sum, d) => sum + d.count, 0),
    weekStart: weekStartDate,
    weekCompleted,
    weekOpenDue,
    weekTaskRate: completionRate(weekCompleted, weekOpenDue),
    habits: aggregateHabitRates(habitRates),
  };
}
