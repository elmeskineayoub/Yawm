import { loadFocusSecondsInRange } from "@/features/focus/queries";
import { loadHabitRatesForRange } from "@/features/habits/queries";
import { loadGoalSummaries, type GoalSummary } from "@/features/goals/queries";
import { loadProjectSummaries, type ProjectSummary } from "@/features/projects/queries";
import { addDays, dateOfInstant, type IsoDate } from "@/lib/dates";
import { zonedRange } from "@/lib/dates/zoned";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { aggregateHabitRates, type ReviewField, type WeekHabitSummary } from "./logic";

export type ReviewText = Record<ReviewField, string | null>;

export type CompletedTask = { id: string; title: string };

export type WeeklyReview = {
  weekStart: IsoDate;
  /** Inclusive last day of the week (weekStart + 6). */
  weekEnd: IsoDate;
  text: ReviewText;
  completedTasks: CompletedTask[];
  completedCount: number;
  /** Open tasks whose deadline fell in the week — the work that carries forward. */
  carriedForward: number;
  habits: WeekHabitSummary;
  focusSeconds: number;
  projects: ProjectSummary[];
  goals: GoalSummary[];
};

const EMPTY_TEXT: ReviewText = {
  went_well: null,
  could_improve: null,
  lessons: null,
  next_focus: null,
};

/** Everything the weekly review shows for the week beginning `weekStart`. */
export async function loadWeeklyReview(
  ctx: WorkspaceContext,
  weekStart: IsoDate,
): Promise<WeeklyReview> {
  const { supabase, workspace, timezone } = ctx;
  const weekEndExclusive = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);
  const instants = zonedRange(weekStart, weekEndExclusive, timezone);

  const [review, completed, carried, habitRates, focusSeconds, projects, goals] = await Promise.all(
    [
      supabase
        .from("weekly_reviews")
        .select("went_well, could_improve, lessons, next_focus")
        .eq("workspace_id", workspace.id)
        .eq("week_start", weekStart)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id, title, completed_at")
        .eq("workspace_id", workspace.id)
        .eq("status", "done")
        .gte("completed_at", instants.start)
        .lt("completed_at", instants.end)
        .limit(500),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .in("status", ["todo", "in_progress"])
        .gte("due_date", weekStart)
        .lte("due_date", weekEnd),
      loadHabitRatesForRange(ctx, weekStart, weekEnd),
      loadFocusSecondsInRange(ctx, { from: weekStart, to: weekEndExclusive }),
      loadProjectSummaries(ctx, { statuses: ["active"] }),
      loadGoalSummaries(ctx, { statuses: ["active"] }),
    ],
  );
  if (review.error || completed.error || carried.error) {
    throw new Error("Could not load the weekly review.");
  }

  // Guard the completed list against timezone edges (the instant range already scopes the query).
  const completedTasks = completed.data
    .filter((t) => t.completed_at && dateOfInstant(t.completed_at, timezone) >= weekStart)
    .map((t) => ({ id: t.id, title: t.title }));

  return {
    weekStart,
    weekEnd,
    text: review.data ? { ...EMPTY_TEXT, ...review.data } : EMPTY_TEXT,
    completedTasks,
    completedCount: completedTasks.length,
    carriedForward: carried.count ?? 0,
    habits: aggregateHabitRates(habitRates),
    focusSeconds,
    projects,
    goals,
  };
}
