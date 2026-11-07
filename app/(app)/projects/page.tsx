import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Section } from "@/components/ui/section";
import { loadGoalOptions } from "@/features/goals/queries";
import { loadProjectSummaries, type ProjectSummary } from "@/features/projects/queries";
import type { ProjectStatus } from "@/features/projects/schemas";
import { listActiveAreas } from "@/lib/db/workspace";
import { relativeDateLabel } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Projects" };

const SECTIONS: { title: string; statuses: ProjectStatus[]; folded?: boolean }[] = [
  { title: "Active", statuses: ["active"] },
  { title: "Planned", statuses: ["planned"] },
  { title: "On hold", statuses: ["on_hold"] },
  { title: "Completed", statuses: ["completed"], folded: true },
  { title: "Archived", statuses: ["archived"], folded: true },
];

/**
 * Projects as outcomes: each row shows what it serves (life area, goal), how far along it is, how
 * much is left, and when it is due. Completed and archived projects are folded away.
 */
export default async function ProjectsPage() {
  const ctx = await getWorkspaceContext();
  const [projects, areas, goals] = await Promise.all([
    loadProjectSummaries(ctx),
    listActiveAreas(ctx.supabase, ctx.workspace.id),
    loadGoalOptions(ctx),
  ]);
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const goalById = new Map(goals.map((g) => [g.id, g]));

  const row = (project: ProjectSummary) => {
    const area = project.area_id ? areaById.get(project.area_id) : undefined;
    const goal = project.goal_id ? goalById.get(project.goal_id) : undefined;
    const overdue =
      project.due_date !== null &&
      project.due_date < ctx.today &&
      project.status !== "completed" &&
      project.status !== "archived";
    return (
      <li
        key={project.id}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {area && (
              <span
                aria-hidden
                title={area.name}
                className="size-2 shrink-0 rounded-full ring-1 ring-foreground/20 ring-inset"
                style={{ backgroundColor: area.color }}
              />
            )}
            <Link
              data-nav-item
              href={`/projects/${project.id}`}
              className="min-w-0 truncate text-sm font-medium hover:underline"
            >
              {project.name}
            </Link>
          </div>
          <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">
            {[
              area?.name,
              goal ? `Goal: ${goal.title}` : null,
              `${project.openTasks} open task${project.openTasks === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="col-span-2 row-start-2 pl-4 sm:col-span-1 sm:row-start-auto sm:pl-0">
          <ProgressBar progress={project.progress} label={`${project.name} progress`} />
        </div>
        <div className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto">
          {project.due_date ? (
            <Badge tone={overdue ? "danger" : "neutral"}>
              {relativeDateLabel(project.due_date, ctx.today)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">No due date</span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Projects"
        description="Outcomes you're working toward. Progress comes from each project's tasks."
      />
      <div className="space-y-8">
        <NewProjectForm areas={areas} />
        {projects.length === 0 ? (
          <EmptyState title="No projects yet">
            Name an outcome above, or convert an idea from the Inbox.
          </EmptyState>
        ) : (
          SECTIONS.map(({ title, statuses, folded }) => {
            const list = projects.filter((p) => statuses.includes(p.status));
            if (list.length === 0) return null;
            const rows = (
              <ul aria-label={`${title} projects`} className="divide-y divide-border">
                {list.map(row)}
              </ul>
            );
            return folded ? (
              <details key={title} className="group border-t border-border pt-6">
                <summary className="cursor-pointer text-sm font-semibold">
                  {title} <span className="font-normal text-muted-foreground">{list.length}</span>
                </summary>
                <div className="mt-2">{rows}</div>
              </details>
            ) : (
              <Section key={title} title={title} count={list.length}>
                {rows}
              </Section>
            );
          })
        )}
      </div>
    </div>
  );
}
