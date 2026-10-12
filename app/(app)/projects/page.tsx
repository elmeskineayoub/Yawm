import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { loadProjectSummaries, type ProjectSummary } from "@/features/projects/queries";
import type { ProjectStatus } from "@/features/projects/schemas";
import { listActiveAreas } from "@/lib/db/workspace";
import { relativeDateLabel } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Projects" };

const SECTIONS: { title: string; statuses: ProjectStatus[] }[] = [
  { title: "Active", statuses: ["active"] },
  { title: "Planned", statuses: ["planned"] },
  { title: "On hold", statuses: ["on_hold"] },
  { title: "Completed", statuses: ["completed"] },
  { title: "Archived", statuses: ["archived"] },
];

export default async function ProjectsPage() {
  const ctx = await getWorkspaceContext();
  const [projects, areas] = await Promise.all([
    loadProjectSummaries(ctx),
    listActiveAreas(ctx.supabase, ctx.workspace.id),
  ]);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const card = (project: ProjectSummary) => {
    const area = project.area_id ? areaById.get(project.area_id) : undefined;
    return (
      <li key={project.id} className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="font-medium break-words hover:underline"
          >
            {project.name}
          </Link>
          {project.due_date && (
            <Badge
              tone={
                project.due_date < ctx.today && project.status !== "completed"
                  ? "danger"
                  : "neutral"
              }
            >
              {relativeDateLabel(project.due_date, ctx.today)}
            </Badge>
          )}
        </div>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {area && (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: area.color }}
              />
              {area.name}
            </span>
          )}
          <span>
            {project.openTasks} open task{project.openTasks === 1 ? "" : "s"}
          </span>
        </p>
        <div className="mt-3">
          <ProgressBar progress={project.progress} label={`${project.name} progress`} />
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Projects" description="Group tasks toward an outcome." />
      <div className="space-y-6">
        <NewProjectForm areas={areas} />
        {projects.length === 0 ? (
          <EmptyState title="No projects yet">
            Create one above, or convert an idea from the Inbox.
          </EmptyState>
        ) : (
          SECTIONS.map(({ title, statuses }) => {
            const list = projects.filter((p) => statuses.includes(p.status));
            if (list.length === 0) return null;
            return (
              <section key={title} aria-labelledby={`projects-${title}`}>
                <h2 id={`projects-${title}`} className="mb-2 text-sm font-semibold">
                  {title} <span className="font-normal text-muted-foreground">{list.length}</span>
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map(card)}</ul>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
