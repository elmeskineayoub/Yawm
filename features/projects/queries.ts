import { isOpen, progressOf, type ProgressSummary, type TaskStatus } from "@/features/tasks/logic";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectSummary = Pick<
  ProjectRow,
  "id" | "name" | "status" | "due_date" | "area_id" | "sort_order"
> & { progress: ProgressSummary; openTasks: number };

/** Projects with progress derived from their tasks (never stored). */
export async function loadProjectSummaries(
  { supabase, workspace }: WorkspaceContext,
  options: { statuses?: ProjectRow["status"][] } = {},
): Promise<ProjectSummary[]> {
  let query = supabase
    .from("projects")
    .select("id, name, status, due_date, area_id, sort_order")
    .eq("workspace_id", workspace.id);
  if (options.statuses) query = query.in("status", options.statuses);
  const [projects, tasks] = await Promise.all([
    query.order("sort_order").order("name"),
    supabase
      .from("tasks")
      .select("project_id, status")
      .eq("workspace_id", workspace.id)
      .not("project_id", "is", null)
      .limit(10_000),
  ]);
  if (projects.error || tasks.error) throw new Error("Could not load projects.");

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
