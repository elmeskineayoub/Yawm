import { loadGoalSummaries, type GoalSummary } from "@/features/goals/queries";
import { loadProjectSummaries, type ProjectSummary } from "@/features/projects/queries";
import { compareTasks, progressOf, type ProgressSummary } from "@/features/tasks/logic";
import {
  enrichTasks,
  loadTasksByIds,
  TASK_COLUMNS,
  type Lookups,
  type TaskView,
} from "@/features/tasks/queries";
import {
  CHILD_PERIOD,
  periodEnd,
  periodStart,
  shiftPeriod,
  type IsoDate,
  type PlanPeriod,
} from "@/lib/dates";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";

export type PlanRow = Database["public"]["Tables"]["plans"]["Row"];

export type PlanMilestone = {
  id: string;
  title: string;
  due_date: IsoDate | null;
  completed_at: string | null;
  goal_id: string;
  goal_title: string;
};

export type PlanItemView =
  | { id: string; kind: "task"; task: TaskView }
  | { id: string; kind: "project"; project: ProjectSummary }
  | { id: string; kind: "goal"; goal: GoalSummary }
  | { id: string; kind: "milestone"; milestone: PlanMilestone };

/** Title, link, and kind label for any plan item (tasks render with their own row). */
export function planItemLink(item: Exclude<PlanItemView, { kind: "task" }>) {
  switch (item.kind) {
    case "project":
      return { title: item.project.name, href: `/projects/${item.project.id}`, label: "project" };
    case "goal":
      return { title: item.goal.title, href: `/goals/${item.goal.id}`, label: "goal" };
    case "milestone":
      return {
        title: item.milestone.title,
        href: `/goals/${item.milestone.goal_id}`,
        label: "milestone",
      };
  }
}

/** The ID of the task, project, goal, or milestone a plan item links. */
export function linkedId(item: PlanItemView): string {
  switch (item.kind) {
    case "task":
      return item.task.id;
    case "project":
      return item.project.id;
    case "goal":
      return item.goal.id;
    case "milestone":
      return item.milestone.id;
  }
}

export type ChildPeriod = {
  period: PlanPeriod;
  start: IsoDate;
  plan: Pick<PlanRow, "id" | "theme"> | null;
  itemCount: number;
};

export type PlanPageData = {
  plan: PlanRow | null;
  items: PlanItemView[];
  progress: ProgressSummary;
  children: ChildPeriod[];
  dueInPeriod: TaskView[];
  parent: { period: PlanPeriod; start: IsoDate; exists: boolean } | null;
};

/** Start dates of the child periods inside a period (weeks are those starting inside a month). */
export function childStarts(period: PlanPeriod, start: IsoDate, weekStart: number): IsoDate[] {
  const child = CHILD_PERIOD[period];
  if (!child) return [];
  const end = periodEnd(period, start);
  const starts: IsoDate[] = [];
  let cursor = child === "week" ? periodStart("week", start, weekStart) : start;
  if (cursor < start) cursor = shiftPeriod("week", cursor, 1);
  while (cursor < end) {
    starts.push(cursor);
    cursor = shiftPeriod(child, cursor, 1);
  }
  return starts;
}

export async function loadPlanPage(
  ctx: WorkspaceContext,
  period: PlanPeriod,
  start: IsoDate,
  parentPeriod: PlanPeriod | null,
  lookups: Lookups,
): Promise<PlanPageData> {
  const { supabase, workspace, weekStart } = ctx;
  const end = periodEnd(period, start);
  const childPeriod = CHILD_PERIOD[period];
  const starts = childStarts(period, start, weekStart);

  const [planResult, childPlans, dueRows, parentPlan] = await Promise.all([
    supabase
      .from("plans")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("period", period)
      .eq("period_start", start)
      .maybeSingle(),
    childPeriod && starts.length
      ? supabase
          .from("plans")
          .select("id, theme, period_start")
          .eq("workspace_id", workspace.id)
          .eq("period", childPeriod)
          .in("period_start", starts)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("workspace_id", workspace.id)
      .gte("due_date", start)
      .lt("due_date", end)
      .neq("status", "cancelled")
      .limit(500),
    parentPeriod
      ? supabase
          .from("plans")
          .select("id")
          .eq("workspace_id", workspace.id)
          .eq("period", parentPeriod)
          .eq("period_start", periodStart(parentPeriod, start, weekStart))
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (planResult.error || childPlans.error || dueRows.error) {
    throw new Error("Could not load the plan.");
  }
  const plan = planResult.data;

  const childIds = (childPlans.data ?? []).map((c) => c.id);
  const [itemRows, childItemRows] = await Promise.all([
    plan
      ? supabase
          .from("plan_items")
          .select("id, task_id, project_id, goal_id, milestone_id, sort_order, created_at")
          .eq("plan_id", plan.id)
          .order("sort_order")
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    childIds.length
      ? supabase.from("plan_items").select("plan_id").in("plan_id", childIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemRows.error) throw new Error("Could not load the plan's links.");

  const taskIds = (itemRows.data ?? []).flatMap((i) => (i.task_id ? [i.task_id] : []));
  const projectIds = new Set(
    (itemRows.data ?? []).flatMap((i) => (i.project_id ? [i.project_id] : [])),
  );
  const goalIds = (itemRows.data ?? []).flatMap((i) => (i.goal_id ? [i.goal_id] : []));
  const milestoneIds = (itemRows.data ?? []).flatMap((i) =>
    i.milestone_id ? [i.milestone_id] : [],
  );
  const [linkedTasks, projects, projectTaskRows, goals, milestoneRows] = await Promise.all([
    loadTasksByIds(ctx, taskIds, lookups),
    projectIds.size ? loadProjectSummaries(ctx) : Promise.resolve([]),
    projectIds.size
      ? supabase
          .from("tasks")
          .select("id, status")
          .in("project_id", [...projectIds])
      : Promise.resolve({ data: [], error: null }),
    goalIds.length ? loadGoalSummaries(ctx, { ids: goalIds }) : Promise.resolve([]),
    milestoneIds.length
      ? supabase
          .from("milestones")
          .select("id, title, due_date, completed_at, goal_id, goals(title)")
          .eq("workspace_id", workspace.id)
          .in("id", milestoneIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const milestoneById = new Map(
    (milestoneRows.data ?? []).map(({ goals: goal, ...m }) => [
      m.id,
      { ...m, goal_title: goal?.title ?? "" },
    ]),
  );
  const taskById = new Map(linkedTasks.map((t) => [t.id, t]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const items: PlanItemView[] = (itemRows.data ?? []).flatMap((item): PlanItemView[] => {
    if (item.task_id) {
      const task = taskById.get(item.task_id);
      return task ? [{ id: item.id, kind: "task", task }] : [];
    }
    if (item.goal_id) {
      const goal = goalById.get(item.goal_id);
      return goal ? [{ id: item.id, kind: "goal", goal }] : [];
    }
    if (item.milestone_id) {
      const milestone = milestoneById.get(item.milestone_id);
      return milestone ? [{ id: item.id, kind: "milestone", milestone }] : [];
    }
    const project = item.project_id ? projectById.get(item.project_id) : undefined;
    return project ? [{ id: item.id, kind: "project", project }] : [];
  });

  // Progress flows from linked tasks, the tasks of linked projects, and the work behind linked
  // goals, counted once each.
  const counted = new Map<string, { status: TaskView["status"] }>();
  for (const t of linkedTasks) counted.set(t.id, t);
  for (const t of projectTaskRows.data ?? []) counted.set(t.id, t);
  const goalTasks = goalIds.length ? await goalWorkTasks(ctx, goalIds) : [];
  for (const t of goalTasks) counted.set(t.id, t);

  const childByStart = new Map((childPlans.data ?? []).map((c) => [c.period_start, c]));
  const itemCounts = new Map<string, number>();
  for (const row of childItemRows.data ?? []) {
    itemCounts.set(row.plan_id, (itemCounts.get(row.plan_id) ?? 0) + 1);
  }

  const dueInPeriod = (await enrichTasks(ctx, dueRows.data, lookups)).sort(compareTasks("due"));

  return {
    plan,
    items,
    progress: progressOf([...counted.values()]),
    children: childPeriod
      ? starts.map((s) => {
          const child = childByStart.get(s);
          return {
            period: childPeriod,
            start: s,
            plan: child ? { id: child.id, theme: child.theme } : null,
            itemCount: child ? (itemCounts.get(child.id) ?? 0) : 0,
          };
        })
      : [],
    dueInPeriod,
    parent: parentPeriod
      ? {
          period: parentPeriod,
          start: periodStart(parentPeriod, start, weekStart),
          exists: Boolean(parentPlan.data),
        }
      : null,
  };
}

/** Tasks behind goals: linked directly or through the goals' projects. */
async function goalWorkTasks(ctx: WorkspaceContext, goalIds: string[]) {
  const { supabase, workspace } = ctx;
  const [direct, projects] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, status")
      .eq("workspace_id", workspace.id)
      .in("goal_id", goalIds)
      .limit(10_000),
    supabase.from("projects").select("id").eq("workspace_id", workspace.id).in("goal_id", goalIds),
  ]);
  if (direct.error || projects.error) throw new Error("Could not load goal progress.");
  if (!projects.data.length) return direct.data;
  const viaProjects = await supabase
    .from("tasks")
    .select("id, status")
    .eq("workspace_id", workspace.id)
    .in(
      "project_id",
      projects.data.map((p) => p.id),
    )
    .limit(10_000);
  if (viaProjects.error) throw new Error("Could not load goal progress.");
  return [...direct.data, ...viaProjects.data];
}
