import "server-only";
import { loadGoalOptions } from "@/features/goals/queries";
import { addDays, type IsoDate, type PlanPeriod } from "@/lib/dates";
import { zonedDayRange } from "@/lib/dates/zoned";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { TaskStatus } from "./logic";
import {
  enrichTasks,
  loadLookups,
  TASK_COLUMNS,
  type Lookups,
  type TaskRow,
  type TaskView,
} from "./queries";

type GoalOption = Awaited<ReturnType<typeof loadGoalOptions>>[number];

export type RelatedTask = { id: string; title: string; status: TaskStatus };

export type TaskDetail = {
  task: TaskRow & { recurs_from_task_id: string | null; goal_id: string | null };
  parent: { id: string; title: string } | null;
  subtasks: TaskView[];
  tagNames: string[];
  dependsOn: RelatedTask[];
  blocks: RelatedTask[];
  /** Tasks this one could be made to wait on. */
  candidates: RelatedTask[];
  plans: { id: string; period: PlanPeriod; period_start: IsoDate }[];
  scheduledBlocks: { id: string; title: string; starts_at: string; ends_at: string }[];
  lookups: Lookups;
  goals: GoalOption[];
};

/**
 * Everything the task detail (full page and side panel) shows, in two parallel rounds of queries.
 * Scoped to the active workspace explicitly as well as by RLS. Returns null if the task is not in
 * this workspace.
 */
export async function loadTaskDetail(
  ctx: WorkspaceContext,
  id: string,
): Promise<TaskDetail | null> {
  const { supabase, workspace } = ctx;
  const { data: task, error } = await supabase
    .from("tasks")
    .select(`${TASK_COLUMNS}, recurs_from_task_id, goal_id`)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (error) throw new Error("Could not load the task.");
  if (!task) return null;

  const [
    lookups,
    subtaskRows,
    tagRows,
    dependsOnRows,
    blocksRows,
    planRows,
    candidateRows,
    parent,
    goals,
    scheduled,
  ] = await Promise.all([
    loadLookups(ctx),
    supabase.from("tasks").select(TASK_COLUMNS).eq("parent_task_id", id).order("created_at"),
    supabase.from("task_tags").select("tag_id").eq("task_id", id),
    supabase.from("task_dependencies").select("depends_on_task_id").eq("task_id", id),
    supabase.from("task_dependencies").select("task_id").eq("depends_on_task_id", id),
    supabase.from("plan_items").select("plan_id").eq("task_id", id),
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("workspace_id", workspace.id)
      .neq("id", id)
      .in("status", ["todo", "in_progress", "done"])
      .order("created_at", { ascending: false })
      .limit(300),
    task.parent_task_id
      ? supabase.from("tasks").select("id, title").eq("id", task.parent_task_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadGoalOptions(ctx),
    supabase
      .from("time_blocks")
      .select("id, title, starts_at, ends_at")
      .eq("workspace_id", workspace.id)
      .eq("task_id", id)
      .gte("ends_at", zonedDayRange(addDays(ctx.today, -7), ctx.timezone).start)
      .order("starts_at")
      .limit(20),
  ]);
  if (subtaskRows.error || tagRows.error || dependsOnRows.error || blocksRows.error) {
    throw new Error("Could not load the task details.");
  }

  const relatedIds = [
    ...(dependsOnRows.data ?? []).map((d) => d.depends_on_task_id),
    ...(blocksRows.data ?? []).map((d) => d.task_id),
  ];
  const [related, plans, subtasks] = await Promise.all([
    relatedIds.length
      ? supabase.from("tasks").select("id, title, status").in("id", relatedIds)
      : Promise.resolve({ data: [] as RelatedTask[], error: null }),
    planRows.data?.length
      ? supabase
          .from("plans")
          .select("id, period, period_start")
          .in(
            "id",
            planRows.data.map((p) => p.plan_id),
          )
      : Promise.resolve({ data: [], error: null }),
    enrichTasks(ctx, subtaskRows.data, lookups),
  ]);

  const relatedById = new Map((related.data ?? []).map((t) => [t.id, t]));
  const pick = (ids: string[]) =>
    ids.map((i) => relatedById.get(i)).filter((t): t is RelatedTask => t !== undefined);
  const tagIds = new Set((tagRows.data ?? []).map((t) => t.tag_id));

  return {
    task,
    parent: parent.data ?? null,
    subtasks,
    tagNames: lookups.tags.filter((t) => tagIds.has(t.id)).map((t) => t.name),
    dependsOn: pick((dependsOnRows.data ?? []).map((d) => d.depends_on_task_id)),
    blocks: pick((blocksRows.data ?? []).map((d) => d.task_id)),
    candidates: (candidateRows.data ?? []).filter((c) => c.status !== "done"),
    plans: (plans.data ?? []).map((p) => ({
      id: p.id,
      period: p.period as PlanPeriod,
      period_start: p.period_start,
    })),
    scheduledBlocks: scheduled.data ?? [],
    lookups,
    goals,
  };
}
