import type { WorkspaceContext } from "@/lib/workspace-context";
import type { TaskStatus } from "@/features/tasks/logic";

export type CalendarBlock = {
  id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  task_id: string | null;
  project_id: string | null;
  editable: boolean;
  task: { id: string; title: string; status: TaskStatus } | null;
};

export type DeadlineMarker = { id: string; title: string; due_date: string; status: TaskStatus };

export type SchedulableTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  estimate_minutes: number | null;
};

/** Blocks overlapping [start, end) (UTC instants), with their linked task. */
export async function loadBlocks(
  { supabase, workspace }: WorkspaceContext,
  range: { start: string; end: string },
): Promise<CalendarBlock[]> {
  const { data, error } = await supabase
    .from("time_blocks")
    .select("id, title, notes, starts_at, ends_at, timezone, task_id, project_id, origin")
    .eq("workspace_id", workspace.id)
    .lt("starts_at", range.end)
    .gt("ends_at", range.start)
    .order("starts_at")
    .limit(2000);
  if (error) throw new Error("Could not load the calendar.");

  const taskIds = [...new Set(data.flatMap((b) => (b.task_id ? [b.task_id] : [])))];
  const tasks = taskIds.length
    ? await supabase.from("tasks").select("id, title, status").in("id", taskIds)
    : { data: [], error: null };
  if (tasks.error) throw new Error("Could not load the calendar.");
  const taskById = new Map(tasks.data.map((t) => [t.id, t]));

  return data.map(({ origin, ...b }) => ({
    ...b,
    editable: origin === "app",
    task: b.task_id ? (taskById.get(b.task_id) ?? null) : null,
  }));
}

/** Open task deadlines (date-only) in [from, to). Shown apart from scheduled blocks. */
export async function loadDeadlines(
  { supabase, workspace }: WorkspaceContext,
  range: { from: string; to: string },
): Promise<DeadlineMarker[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_date, status")
    .eq("workspace_id", workspace.id)
    .gte("due_date", range.from)
    .lt("due_date", range.to)
    .neq("status", "cancelled")
    .order("due_date")
    .limit(500);
  if (error) throw new Error("Could not load deadlines.");
  return data.flatMap((t) => (t.due_date ? [{ ...t, due_date: t.due_date }] : []));
}

/** Task IDs per `in` filter, keeping the request URL well under PostgREST's limits. */
const ID_CHUNK = 100;

/**
 * Open tasks and every block scheduled for them, for the unscheduled tray and the
 * "needs rescheduling" list. Blocks are not cut off by age: a task whose only block was months
 * ago still needs a decision.
 */
export async function loadSchedulingState({ supabase, workspace }: WorkspaceContext) {
  const tasks = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, estimate_minutes")
    .eq("workspace_id", workspace.id)
    .in("status", ["todo", "in_progress"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (tasks.error) throw new Error("Could not load scheduling details.");

  const ids = tasks.data.map((t) => t.id);
  const chunks = Array.from({ length: Math.ceil(ids.length / ID_CHUNK) }, (_, i) =>
    ids.slice(i * ID_CHUNK, (i + 1) * ID_CHUNK),
  );
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("time_blocks")
        .select("task_id, starts_at, ends_at")
        .eq("workspace_id", workspace.id)
        .in("task_id", chunk),
    ),
  );
  const blocks = results.flatMap((r) => {
    if (r.error) throw new Error("Could not load scheduling details.");
    return r.data;
  });
  return { tasks: tasks.data as SchedulableTask[], blocks };
}
