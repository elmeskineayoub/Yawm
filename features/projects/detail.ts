import "server-only";
import { loadGoalOptions, loadGoalSummaries, type GoalSummary } from "@/features/goals/queries";
import { compareTasks, isOpen, progressOf, type ProgressSummary } from "@/features/tasks/logic";
import {
  enrichTasks,
  loadLookups,
  TASK_COLUMNS,
  type Lookups,
  type TaskView,
} from "@/features/tasks/queries";
import type { Tables } from "@/lib/db/types";
import type { WorkspaceContext } from "@/lib/workspace-context";

export type ProjectMilestone = Pick<
  Tables["milestones"]["Row"],
  "id" | "title" | "due_date" | "completed_at"
>;
export type LinkedNote = Pick<Tables["notes"]["Row"], "id" | "title" | "body" | "updated_at">;

export type ProjectDetail = {
  project: Tables["projects"]["Row"];
  open: TaskView[];
  finished: TaskView[];
  progress: ProgressSummary;
  /** The goal this project serves, with its milestones, if it is linked to one. */
  goal: GoalSummary | null;
  milestones: ProjectMilestone[];
  notes: LinkedNote[];
  lookups: Lookups;
  goalOptions: Awaited<ReturnType<typeof loadGoalOptions>>;
};

/** Notes shown on a project page (the Notes page lists them all). */
const NOTE_LIMIT = 10;

/**
 * Everything the project page shows, scoped to the active workspace explicitly as well as by RLS:
 * the outcome and details, its tasks and derived progress, the goal it serves with that goal's
 * milestones (Area -> Goal -> Project -> Tasks), and notes linked to it. Null if not found.
 */
export async function loadProjectDetail(
  ctx: WorkspaceContext,
  id: string,
): Promise<ProjectDetail | null> {
  const { supabase, workspace } = ctx;
  const [project, taskRows, lookups, goalOptions, notes] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("project_id", id)
      .eq("workspace_id", workspace.id)
      .limit(1000),
    loadLookups(ctx),
    loadGoalOptions(ctx),
    supabase
      .from("notes")
      .select("id, title, body, updated_at")
      .eq("workspace_id", workspace.id)
      .eq("project_id", id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(NOTE_LIMIT),
  ]);
  if (project.error || taskRows.error) throw new Error("Could not load the project.");
  if (!project.data) return null;

  const goalId = project.data.goal_id;
  const [tasks, goals, milestones] = await Promise.all([
    enrichTasks(ctx, taskRows.data, lookups),
    goalId ? loadGoalSummaries(ctx, { ids: [goalId] }) : Promise.resolve([]),
    goalId
      ? supabase
          .from("milestones")
          .select("id, title, due_date, completed_at")
          .eq("workspace_id", workspace.id)
          .eq("goal_id", goalId)
          .order("sort_order")
          .limit(50)
      : Promise.resolve({ data: [] as ProjectMilestone[], error: null }),
  ]);

  return {
    project: project.data,
    open: tasks.filter((t) => isOpen(t.status)).sort(compareTasks("due")),
    finished: tasks
      .filter((t) => !isOpen(t.status))
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    progress: progressOf(tasks),
    goal: goals[0] ?? null,
    milestones: milestones.data ?? [],
    notes: notes.data ?? [],
    lookups,
    goalOptions,
  };
}
