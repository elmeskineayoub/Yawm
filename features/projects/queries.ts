import { isOpen, progressOf, type ProgressSummary, type TaskStatus } from "@/features/tasks/logic";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectSummary = Pick<
  ProjectRow,
  "id" | "name" | "status" | "due_date" | "area_id" | "sort_order" | "goal_id"
> & { progress: ProgressSummary; openTasks: number };

/** Projects with progress derived from their tasks (never stored). */
export async function loadProjectSummaries(
  { supabase, workspace }: WorkspaceContext,
  options: { statuses?: ProjectRow["status"][]; goalId?: string } = {},
): Promise<ProjectSummary[]> {
  let query = supabase
    .from("projects")
    .select("id, name, status, due_date, area_id, sort_order, goal_id")
    .eq("workspace_id", workspace.id);
  if (options.statuses) query = query.in("status", options.statuses);
  if (options.goalId) query = query.eq("goal_id", options.goalId);
  const projects = await query.order("sort_order").order("name");
  if (projects.error) throw new Error("Could not load projects.");

  // Only load task rows for the projects actually being shown (uses the project_id index), instead
  // of scanning every task in the workspace — a big win when few projects are shown (e.g. the
  // dashboard's active projects).
  const projectIds = projects.data.map((p) => p.id);
  const tasks = projectIds.length
    ? await supabase
        .from("tasks")
        .select("project_id, status")
        .eq("workspace_id", workspace.id)
        .in("project_id", projectIds)
        .limit(10_000)
    : { data: [] as { project_id: string | null; status: TaskStatus }[], error: null };
  if (tasks.error) throw new Error("Could not load projects.");

  const byProject = new Map<string, { status: TaskStatus }[]>();
  for (const t of tasks.data) {
    if (!t.project_id) continue;
    byProject.set(t.project_id, [...(byProject.get(t.project_id) ?? []), t]);
  }
  return projects.data.map((p) => {
    const projectTasks = byProject.get(p.id) ?? [];
    return {
      ...p,
      progress: progressOf(projectTasks),
      openTasks: projectTasks.filter((t) => isOpen(t.status)).length,
    };
  });
}
