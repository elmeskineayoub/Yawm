import { addDays, type IsoDate } from "@/lib/dates";
import { ilikeAny } from "@/lib/search";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";
import { compareTasks, isOpen, type TaskStatus } from "./logic";
import type { TaskFilters } from "./filters";

type Tables = Database["public"]["Tables"];

export const TASK_COLUMNS =
  "id, title, description, status, priority, due_date, due_time, estimate_minutes, project_id, area_id, parent_task_id, sort_order, completed_at, created_at, recurrence_frequency, recurrence_interval, recurrence_weekdays, recurrence_until, recurrence_anchor" as const;

export type TaskRow = Pick<
  Tables["tasks"]["Row"],
  | "id"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "due_date"
  | "due_time"
  | "estimate_minutes"
  | "project_id"
  | "area_id"
  | "parent_task_id"
  | "sort_order"
  | "completed_at"
  | "created_at"
  | "recurrence_frequency"
  | "recurrence_interval"
  | "recurrence_weekdays"
  | "recurrence_until"
  | "recurrence_anchor"
>;

export type ProjectLite = Pick<Tables["projects"]["Row"], "id" | "name" | "status">;
export type AreaLite = Pick<Tables["areas"]["Row"], "id" | "name" | "color" | "archived_at">;
export type TagLite = Pick<Tables["tags"]["Row"], "id" | "name" | "color">;

export type TaskView = TaskRow & {
  project: ProjectLite | null;
  area: AreaLite | null;
  tags: TagLite[];
  subtasks: { total: number; done: number };
  /** Unfinished tasks this one depends on. */
  openBlockers: number;
};

export type Lookups = { projects: ProjectLite[]; areas: AreaLite[]; tags: TagLite[] };

const LIMIT = 1000;

export async function loadLookups({ supabase, workspace }: WorkspaceContext): Promise<Lookups> {
  const [projects, areas, tags] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("workspace_id", workspace.id)
      .order("name"),
    supabase
      .from("areas")
      .select("id, name, color, archived_at")
      .eq("workspace_id", workspace.id)
      .order("sort_order")
      .order("name"),
    supabase.from("tags").select("id, name, color").eq("workspace_id", workspace.id).order("name"),
  ]);
  if (projects.error || areas.error || tags.error) throw new Error("Could not load your lists.");
  return { projects: projects.data, areas: areas.data, tags: tags.data };
}

/** Adds project, area, tags, subtask counts, and blocker counts to raw rows. */
export async function enrichTasks(
  ctx: WorkspaceContext,
  rows: TaskRow[],
  lookups: Lookups,
): Promise<TaskView[]> {
  if (rows.length === 0) return [];
  const { supabase, workspace } = ctx;
  const [taskTags, deps, statuses] = await Promise.all([
    supabase.from("task_tags").select("task_id, tag_id").eq("workspace_id", workspace.id),
    supabase
      .from("task_dependencies")
      .select("task_id, depends_on_task_id")
      .eq("workspace_id", workspace.id),
    supabase
      .from("tasks")
      .select("id, status, parent_task_id")
      .eq("workspace_id", workspace.id)
      .limit(10_000),
  ]);
  if (taskTags.error || deps.error || statuses.error)
    throw new Error("Could not load task details.");

  const projectById = new Map(lookups.projects.map((p) => [p.id, p]));
  const areaById = new Map(lookups.areas.map((a) => [a.id, a]));
  const tagById = new Map(lookups.tags.map((t) => [t.id, t]));
  const statusById = new Map<string, TaskStatus>(statuses.data.map((t) => [t.id, t.status]));

  const tagsByTask = new Map<string, TagLite[]>();
  for (const { task_id, tag_id } of taskTags.data) {
    const tag = tagById.get(tag_id);
    if (tag) tagsByTask.set(task_id, [...(tagsByTask.get(task_id) ?? []), tag]);
  }
  const subtasks = new Map<string, { total: number; done: number }>();
  for (const t of statuses.data) {
    if (!t.parent_task_id || t.status === "cancelled") continue;
    const entry = subtasks.get(t.parent_task_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (t.status === "done") entry.done += 1;
    subtasks.set(t.parent_task_id, entry);
  }
  const blockers = new Map<string, number>();
  for (const { task_id, depends_on_task_id } of deps.data) {
    const status = statusById.get(depends_on_task_id);
    if (status && isOpen(status)) blockers.set(task_id, (blockers.get(task_id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...row,
    project: row.project_id ? (projectById.get(row.project_id) ?? null) : null,
    area: row.area_id ? (areaById.get(row.area_id) ?? null) : null,
    tags: (tagsByTask.get(row.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    subtasks: subtasks.get(row.id) ?? { total: 0, done: 0 },
    openBlockers: blockers.get(row.id) ?? 0,
  }));
}

export async function loadFilteredTasks(
  ctx: WorkspaceContext,
  filters: TaskFilters,
  lookups: Lookups,
): Promise<{ tasks: TaskView[]; truncated: boolean }> {
  const { supabase, workspace, today } = ctx;
  let query = supabase.from("tasks").select(TASK_COLUMNS).eq("workspace_id", workspace.id);

  if (filters.status === "open") query = query.in("status", ["todo", "in_progress"]);
  else if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.q) query = query.or(ilikeAny(["title", "description"], filters.q));
  // Subtasks appear under their parent, except in search results.
  else query = query.is("parent_task_id", null);

  switch (filters.due) {
    case "overdue":
      query = query.lt("due_date", today);
      break;
    case "today":
      query = query.eq("due_date", today);
      break;
    case "week":
      query = query.gte("due_date", today).lt("due_date", addDays(today, 7));
      break;
    case "none":
      query = query.is("due_date", null);
      break;
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(LIMIT + 1);
  if (error) throw new Error("Could not load tasks.");

  let tasks = await enrichTasks(ctx, data.slice(0, LIMIT), lookups);
  if (filters.tagId) tasks = tasks.filter((t) => t.tags.some((tag) => tag.id === filters.tagId));
  tasks.sort(compareTasks(filters.sort));
  return { tasks, truncated: data.length > LIMIT };
}

/** Open tasks due in [from, to), plus overdue ones when `includeOverdue`. */
export async function loadDueTasks(
  ctx: WorkspaceContext,
  lookups: Lookups,
  range: { from: IsoDate; to: IsoDate; includeOverdue?: boolean },
): Promise<TaskView[]> {
  const { supabase, workspace } = ctx;
  let query = supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("workspace_id", workspace.id)
    .in("status", ["todo", "in_progress"])
    .lt("due_date", range.to);
  if (!range.includeOverdue) query = query.gte("due_date", range.from);
  const { data, error } = await query.limit(LIMIT);
  if (error) throw new Error("Could not load tasks.");
  const tasks = await enrichTasks(ctx, data, lookups);
  return tasks.sort(compareTasks("due"));
}

export async function loadTasksByIds(
  ctx: WorkspaceContext,
  ids: string[],
  lookups: Lookups,
): Promise<TaskView[]> {
  if (ids.length === 0) return [];
  const { data, error } = await ctx.supabase.from("tasks").select(TASK_COLUMNS).in("id", ids);
  if (error) throw new Error("Could not load tasks.");
  return enrichTasks(ctx, data, lookups);
}
