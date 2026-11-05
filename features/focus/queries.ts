import { addDays, periodStart } from "@/lib/dates";
import { zonedDayRange, zonedRange } from "@/lib/dates/zoned";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { FocusPhase, ProjectFocusTotals } from "./logic";
import { aggregateProjectFocus, totalFocusSeconds } from "./logic";

export type RecentFocusSession = {
  id: string;
  session_type: FocusPhase;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  task: { id: string; title: string } | null;
};

export type FocusSummary = {
  todaySeconds: number;
  weekSeconds: number;
  todayCount: number;
  recent: RecentFocusSession[];
};

/** Today's and this week's focus totals (focus sessions only) plus the most recent sessions. */
export async function loadFocusSummary(ctx: WorkspaceContext): Promise<FocusSummary> {
  const { supabase, workspace, today, timezone, weekStart } = ctx;
  const day = zonedDayRange(today, timezone);
  const weekStartDate = periodStart("week", today, weekStart);
  const week = zonedRange(weekStartDate, addDays(weekStartDate, 7), timezone);

  const [weekRows, recentRows] = await Promise.all([
    supabase
      .from("focus_sessions")
      .select("session_type, duration_seconds, started_at")
      .eq("workspace_id", workspace.id)
      .gte("started_at", week.start)
      .lt("started_at", week.end)
      .limit(5000),
    supabase
      .from("focus_sessions")
      .select("id, session_type, started_at, ended_at, duration_seconds, task:tasks(id, title)")
      .eq("workspace_id", workspace.id)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);
  if (weekRows.error || recentRows.error) throw new Error("Could not load focus sessions.");

  const inDay = weekRows.data.filter((s) => s.started_at >= day.start && s.started_at < day.end);
  return {
    todaySeconds: totalFocusSeconds(inDay),
    weekSeconds: totalFocusSeconds(weekRows.data),
    todayCount: inDay.filter((s) => s.session_type === "focus").length,
    recent: recentRows.data.map((s) => ({
      id: s.id,
      session_type: s.session_type,
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration_seconds: s.duration_seconds,
      task: s.task ?? null,
    })),
  };
}

/** Focus seconds in a half-open [from, to) date range, for the weekly review. */
export async function loadFocusSecondsInRange(
  ctx: WorkspaceContext,
  range: { from: string; to: string },
): Promise<number> {
  const { start, end } = zonedRange(range.from, range.to, ctx.timezone);
  const { data, error } = await ctx.supabase
    .from("focus_sessions")
    .select("session_type, duration_seconds")
    .eq("workspace_id", ctx.workspace.id)
    .eq("session_type", "focus")
    .gte("started_at", start)
    .lt("started_at", end)
    .limit(5000);
  if (error) throw new Error("Could not load focus time.");
  return totalFocusSeconds(data);
}

/** Upper bound on rows summed for project totals (personal scale; sessions are short). */
const PROJECT_ROWS_LIMIT = 20000;

/**
 * Focus time per project (today, this week, all time). `available` is false when the project
 * column does not exist yet (migration 20261107090000 not applied): callers then show that
 * project tracking needs the database update instead of failing.
 */
export async function loadProjectFocusTotals(
  ctx: WorkspaceContext,
  projectIds?: string[],
): Promise<{ available: boolean; totals: Record<string, ProjectFocusTotals> }> {
  const { supabase, workspace, today, timezone, weekStart } = ctx;
  if (projectIds && projectIds.length === 0) return { available: true, totals: {} };
  let query = supabase
    .from("focus_sessions")
    .select("project_id, session_type, duration_seconds, started_at")
    .eq("workspace_id", workspace.id)
    .eq("session_type", "focus")
    .not("project_id", "is", null);
  if (projectIds) query = query.in("project_id", projectIds);
  const { data, error } = await query.limit(PROJECT_ROWS_LIMIT);
  if (error) return { available: false, totals: {} };
  const weekStartDate = periodStart("week", today, weekStart);
  return {
    available: true,
    totals: aggregateProjectFocus(
      data,
      zonedDayRange(today, timezone),
      zonedRange(weekStartDate, addDays(weekStartDate, 7), timezone),
    ),
  };
}

/** Which project each of these sessions counted toward (best effort; empty if unavailable). */
export async function loadSessionProjects(
  ctx: WorkspaceContext,
  sessionIds: string[],
): Promise<Record<string, string>> {
  if (sessionIds.length === 0) return {};
  const { data, error } = await ctx.supabase
    .from("focus_sessions")
    .select("id, project_id")
    .eq("workspace_id", ctx.workspace.id)
    .in("id", sessionIds);
  if (error) return {};
  return Object.fromEntries(data.flatMap((r) => (r.project_id ? [[r.id, r.project_id]] : [])));
}
