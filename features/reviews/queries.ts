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
export type CarriedTask = {
  id: string;
  title: string;
  due_date: IsoDate;
  status: "todo" | "in_progress";
};

export type WeeklyReview = {
  weekStart: IsoDate;
  /** Inclusive last day of the week (weekStart + 6). */
  weekEnd: IsoDate;
  text: ReviewText;
  completedTasks: CompletedTask[];
  completedCount: number;
  /** Open tasks whose deadline fell in the week — the work that carries forward. */
  carriedForward: number;
  /** Those tasks (up to 100, earliest deadline first), for the Decide step. */
  carriedTasks: CarriedTask[];
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
        .select("id, title, due_date, status", { count: "exact" })
        .eq("workspace_id", workspace.id)
        .in("status", ["todo", "in_progress"])
        .gte("due_date", weekStart)
        .lte("due_date", weekEnd)
        .order("due_date")
        .order("created_at")
        .limit(100),
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
    carriedForward: carried.count ?? carried.data.length,
    carriedTasks: carried.data.flatMap((t) =>
      t.due_date && (t.status === "todo" || t.status === "in_progress")
        ? [{ id: t.id, title: t.title, due_date: t.due_date, status: t.status }]
        : [],
    ),
    habits: aggregateHabitRates(habitRates),
    focusSeconds,
    projects,
    goals,
  };
}

export type NextWeekPriority = {
  id: string;
  kind: "task" | "project" | "goal" | "milestone";
  title: string;
  href: string;
  done: boolean;
};

/** The week plan that follows the review: its theme and priorities, if any were set yet. */
export async function loadWeekPlanSummary(
  ctx: WorkspaceContext,
  weekStart: IsoDate,
): Promise<{ theme: string | null; priorities: NextWeekPriority[] }> {
  const { supabase, workspace } = ctx;
  const plan = await supabase
    .from("plans")
    .select("id, theme")
    .eq("workspace_id", workspace.id)
    .eq("period", "week")
    .eq("period_start", weekStart)
    .maybeSingle();
  if (plan.error || !plan.data) return { theme: null, priorities: [] };
  const items = await supabase
    .from("plan_items")
    .select("task_id, project_id, goal_id, milestone_id")
    .eq("plan_id", plan.data.id)
    .order("sort_order")
    .order("created_at");
  if (items.error) return { theme: plan.data.theme, priorities: [] };
  const ids = (key: "task_id" | "project_id" | "goal_id" | "milestone_id") =>
    items.data.flatMap((i) => (i[key] ? [i[key]] : []));
  const [tasks, projects, goals, milestones] = await Promise.all([
    ids("task_id").length
      ? supabase.from("tasks").select("id, title, status").in("id", ids("task_id"))
      : Promise.resolve({ data: [], error: null }),
    ids("project_id").length
      ? supabase.from("projects").select("id, name, status").in("id", ids("project_id"))
      : Promise.resolve({ data: [], error: null }),
    ids("goal_id").length
      ? supabase.from("goals").select("id, title, status").in("id", ids("goal_id"))
      : Promise.resolve({ data: [], error: null }),
    ids("milestone_id").length
      ? supabase
          .from("milestones")
          .select("id, title, goal_id, completed_at")
          .in("id", ids("milestone_id"))
      : Promise.resolve({ data: [], error: null }),
  ]);
  const priorities: NextWeekPriority[] = items.data.flatMap((i): NextWeekPriority[] => {
    if (i.task_id) {
      const t = tasks.data?.find((x) => x.id === i.task_id);
      return t
        ? [
            {
              id: t.id,
              kind: "task",
              title: t.title,
              href: `/tasks/${t.id}`,
              done: t.status === "done",
            },
          ]
        : [];
    }
    if (i.project_id) {
      const p = projects.data?.find((x) => x.id === i.project_id);
      return p
        ? [
            {
              id: p.id,
              kind: "project",
              title: p.name,
              href: `/projects/${p.id}`,
              done: p.status === "completed",
            },
          ]
        : [];
    }
    if (i.goal_id) {
      const g = goals.data?.find((x) => x.id === i.goal_id);
      return g
        ? [
            {
              id: g.id,
              kind: "goal",
              title: g.title,
              href: `/goals/${g.id}`,
              done: g.status === "achieved",
            },
          ]
        : [];
    }
    if (i.milestone_id) {
      const m = milestones.data?.find((x) => x.id === i.milestone_id);
      return m
        ? [
            {
              id: m.id,
              kind: "milestone",
              title: m.title,
              href: `/goals/${m.goal_id}`,
              done: m.completed_at !== null,
            },
          ]
        : [];
    }
    return [];
  });
  return { theme: plan.data.theme, priorities };
}
