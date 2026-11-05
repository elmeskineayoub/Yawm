import type { Metadata } from "next";
import { z } from "zod";
import { FocusWorkspace } from "@/components/focus/focus-workspace";
import {
  loadFocusSummary,
  loadProjectFocusTotals,
  loadSessionProjects,
} from "@/features/focus/queries";
import { loadLookups } from "@/features/tasks/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Focus" };

/** Projects you can focus on: anything not completed or archived. */
const FOCUSABLE = ["planned", "active", "on_hold"] as const;

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawProject = Array.isArray(params.project) ? params.project[0] : params.project;
  const ctx = await getWorkspaceContext();
  const [summary, areas, projectRows, tasks] = await Promise.all([
    loadFocusSummary(ctx),
    loadLookups(ctx).then((l) => l.areas),
    ctx.supabase
      .from("projects")
      .select("id, name, status, area_id")
      .eq("workspace_id", ctx.workspace.id)
      .in("status", [...FOCUSABLE])
      .order("sort_order")
      .order("name"),
    ctx.supabase
      .from("tasks")
      .select("id, title, project_id")
      .eq("workspace_id", ctx.workspace.id)
      .in("status", ["todo", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  if (tasks.error || projectRows.error) throw new Error("Could not load tasks and projects.");

  const areaColor = new Map(areas.map((a) => [a.id, a.color]));
  const projects = projectRows.data.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.area_id ? (areaColor.get(p.area_id) ?? null) : null,
  }));
  const [projectTotals, sessionProjects] = await Promise.all([
    loadProjectFocusTotals(
      ctx,
      projects.map((p) => p.id),
    ),
    loadSessionProjects(
      ctx,
      summary.recent.map((s) => s.id),
    ),
  ]);
  const initialProjectId =
    z.uuid().safeParse(rawProject).success && projects.some((p) => p.id === rawProject)
      ? (rawProject as string)
      : null;

  return (
    <FocusWorkspace
      projects={projects}
      tasks={tasks.data}
      totals={projectTotals.totals}
      projectTrackingAvailable={projectTotals.available}
      today={{ seconds: summary.todaySeconds, sessions: summary.todayCount }}
      weekSeconds={summary.weekSeconds}
      recent={summary.recent}
      sessionProjects={sessionProjects}
      timezone={ctx.timezone}
      initialProjectId={initialProjectId}
    />
  );
}
