import { loadProjectSummaries, type ProjectSummary } from "@/features/projects/queries";
import { compareTasks, type TaskStatus } from "@/features/tasks/logic";
import { enrichTasks, TASK_COLUMNS, type Lookups, type TaskView } from "@/features/tasks/queries";
import type { IsoDate } from "@/lib/dates";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";
import {
  goalProgress,
  nextMilestone,
  sortMilestones,
  type GoalProgress,
  type GoalStatus,
  type MilestoneLike,
} from "./logic";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

export type Goal = Omit<GoalRow, "target_value" | "current_value" | "workspace_id"> & {
  target_value: number | null;
  current_value: number | null;
};
export type Milestone = MilestoneLike & { goal_id: string };

export type GoalSummary = Goal & {
  progress: GoalProgress;
  next: Milestone | null;
  projectCount: number;
};

const GOAL_COLUMNS =
  "id, title, description, why, status, area_id, start_date, target_date, target_value, current_value, unit, sort_order, created_at, updated_at";

function toGoal(row: Record<string, unknown>): Goal {
  const g = row as Goal;
  return {
    ...g,
    target_value: g.target_value === null ? null : Number(g.target_value),
    current_value: g.current_value === null ? null : Number(g.current_value),
  };
}

/** Milestones, linked projects, and the tasks behind each goal, for progress. */
async function loadGoalParts(ctx: WorkspaceContext, goalIds: string[]) {
  const { supabase, workspace } = ctx;
  if (!goalIds.length) {
    return {
      milestones: [],
      projects: [],
      tasks: [] as { id: string; status: TaskStatus; goal: string }[],
    };
  }
  const [milestones, projects, directTasks] = await Promise.all([
    supabase
      .from("milestones")
      .select("id, goal_id, title, due_date, completed_at, sort_order")
      .eq("workspace_id", workspace.id)
      .in("goal_id", goalIds)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("projects")
      .select("id, goal_id")
      .eq("workspace_id", workspace.id)
      .in("goal_id", goalIds),
    supabase
      .from("tasks")
      .select("id, status, goal_id")
      .eq("workspace_id", workspace.id)
      .in("goal_id", goalIds)
      .limit(10_000),
  ]);
  if (milestones.error || projects.error || directTasks.error) {
    throw new Error("Could not load goal progress.");
  }
  const projectGoal = new Map(projects.data.map((p) => [p.id, p.goal_id!]));
  const projectTasks = projectGoal.size
    ? await supabase
        .from("tasks")
        .select("id, status, project_id")
        .eq("workspace_id", workspace.id)
        .in("project_id", [...projectGoal.keys()])
        .limit(10_000)
    : { data: [], error: null };
  if (projectTasks.error) throw new Error("Could not load goal progress.");
  return {
    milestones: milestones.data,
    projects: projects.data,
    tasks: [
      ...directTasks.data.map((t) => ({ id: t.id, status: t.status, goal: t.goal_id! })),
      ...projectTasks.data.map((t) => ({
        id: t.id,
        status: t.status,
        goal: projectGoal.get(t.project_id!)!,
      })),
    ],
  };
}

export async function loadGoalSummaries(
  ctx: WorkspaceContext,
  options: { statuses?: GoalStatus[]; ids?: string[] } = {},
): Promise<GoalSummary[]> {
  let query = ctx.supabase.from("goals").select(GOAL_COLUMNS).eq("workspace_id", ctx.workspace.id);
  if (options.statuses) query = query.in("status", options.statuses);
  if (options.ids) {
    if (!options.ids.length) return [];
    query = query.in("id", options.ids);
  }
  const { data, error } = await query.order("sort_order").order("created_at");
  if (error) throw new Error("Could not load your goals.");
  const goals = data.map(toGoal);
  const parts = await loadGoalParts(
    ctx,
    goals.map((g) => g.id),
  );
  return goals.map((goal) => {
    const milestones = parts.milestones.filter((m) => m.goal_id === goal.id);
    return {
      ...goal,
      progress: goalProgress(
        goal,
        milestones,
        parts.tasks.filter((t) => t.goal === goal.id),
      ),
      next: nextMilestone(milestones),
      projectCount: parts.projects.filter((p) => p.goal_id === goal.id).length,
    };
  });
}

/** Goals for pickers (projects, tasks, vision cards). Archived goals are left out. */
export async function loadGoalOptions(ctx: WorkspaceContext) {
  const { data, error } = await ctx.supabase
    .from("goals")
    .select("id, title, status")
    .eq("workspace_id", ctx.workspace.id)
    .neq("status", "archived")
    .order("sort_order")
    .order("title");
  if (error) throw new Error("Could not load your goals.");
  return data;
}

export type GoalDetail = {
  goal: Goal;
  milestones: Milestone[];
  progress: GoalProgress;
  projects: ProjectSummary[];
  tasks: TaskView[];
};

export async function loadGoalDetail(
  ctx: WorkspaceContext,
  goalId: string,
  lookups: Lookups,
): Promise<GoalDetail | null> {
  const { data, error } = await ctx.supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("workspace_id", ctx.workspace.id)
    .eq("id", goalId)
    .maybeSingle();
  if (error) throw new Error("Could not load the goal.");
  if (!data) return null;
  const goal = toGoal(data);
  const [parts, projects, taskRows] = await Promise.all([
    loadGoalParts(ctx, [goal.id]),
    loadProjectSummaries(ctx, { goalId: goal.id }),
    ctx.supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("workspace_id", ctx.workspace.id)
      .eq("goal_id", goal.id)
      .limit(500),
  ]);
  if (taskRows.error) throw new Error("Could not load the goal's tasks.");
  const milestones = sortMilestones(parts.milestones);
  return {
    goal,
    milestones,
    progress: goalProgress(goal, milestones, parts.tasks),
    projects,
    tasks: (await enrichTasks(ctx, taskRows.data, lookups)).sort(compareTasks("due")),
  };
}

export type MilestoneDue = Milestone & { goal_title: string };

/** Open milestones due in [from, to), with their goal's title (the Month plan lists these). */
export async function loadMilestonesDue(
  ctx: WorkspaceContext,
  range: { from: IsoDate; to: IsoDate },
): Promise<MilestoneDue[]> {
  const { data, error } = await ctx.supabase
    .from("milestones")
    .select("id, goal_id, title, due_date, completed_at, sort_order, goals(title)")
    .eq("workspace_id", ctx.workspace.id)
    .gte("due_date", range.from)
    .lt("due_date", range.to)
    .order("due_date")
    .limit(100);
  if (error) throw new Error("Could not load milestones.");
  return data.map(({ goals, ...m }) => ({ ...m, goal_title: goals?.title ?? "" }));
}
