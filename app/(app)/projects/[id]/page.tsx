import type { Metadata } from "next";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { GoalSelect } from "@/components/goals/goal-links";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectEditForm } from "@/components/projects/project-edit-form";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskList } from "@/components/tasks/task-row";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Section } from "@/components/ui/section";
import { formatDuration } from "@/features/focus/logic";
import { loadProjectFocusTotals } from "@/features/focus/queries";
import { loadProjectDetail } from "@/features/projects/detail";
import { PROJECT_STATUS_LABELS } from "@/features/projects/schemas";
import { dateOfInstant, formatDate, relativeDateLabel } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Project" };

/**
 * A project is an outcome: what it is for (the goal and life area it serves), how far along it is
 * (progress derived from its tasks), what is left to do, and what has been written about it.
 */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await getWorkspaceContext();
  const [detail, focus] = await Promise.all([
    loadProjectDetail(ctx, id),
    loadProjectFocusTotals(ctx, [id]),
  ]);
  if (!detail) notFound();
  const focusTime = focus.totals[id] ?? { todaySeconds: 0, weekSeconds: 0, totalSeconds: 0 };
  const { project, open, finished, progress, goal, milestones, notes, lookups } = detail;
  const area = lookups.areas.find((a) => a.id === project.area_id) ?? null;
  const overdue =
    project.due_date !== null && project.due_date < ctx.today && project.status !== "completed";

  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumb={[{ label: "Projects", href: "/projects" }]}
        meta={
          <>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={project.status === "active" ? "success" : "neutral"}>
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
              {project.due_date && (
                <Badge tone={overdue ? "danger" : "neutral"}>
                  Due {relativeDateLabel(project.due_date, ctx.today)}
                </Badge>
              )}
              {/* The chain this project belongs to: life area, then goal. */}
              {area && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 rounded-full ring-1 ring-foreground/20 ring-inset"
                    style={{ backgroundColor: area.color }}
                  />
                  {area.name}
                </span>
              )}
              {goal && (
                <span>
                  {area ? "› " : ""}Goal:{" "}
                  <Link href={`/goals/${goal.id}`} className="text-accent hover:underline">
                    {goal.title}
                  </Link>
                </span>
              )}
            </span>
            <div className="mt-3 max-w-md">
              <ProgressBar progress={progress} label="Project progress" />
            </div>
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <Section title="Tasks" count={open.length || undefined}>
            <div className="mb-2">
              <QuickAddTask projectId={project.id} placeholder="Add a task to this project" />
            </div>
            {open.length === 0 ? (
              <EmptyState title={finished.length ? "Every task is done" : "No tasks yet"}>
                {finished.length
                  ? "Add the next step above, or mark the project completed."
                  : "What is the first concrete step? Add it above."}
              </EmptyState>
            ) : (
              <TaskList tasks={open} today={ctx.today} label="Open tasks" showProject={false} />
            )}
            {finished.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  {finished.length} finished
                </summary>
                <TaskList
                  tasks={finished}
                  today={ctx.today}
                  label="Finished tasks"
                  showProject={false}
                />
              </details>
            )}
          </Section>

          {goal && (
            <Section
              title="Toward a goal"
              divider
              actions={
                <Link href={`/goals/${goal.id}`} className="text-accent hover:underline">
                  Open goal
                </Link>
              }
            >
              <p className="font-serif text-lg">{goal.title}</p>
              {goal.why && (
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">{goal.why}</p>
              )}
              {milestones.length > 0 && (
                <ol aria-label="Goal milestones" className="mt-4 space-y-1.5">
                  {milestones.map((m) => (
                    <li key={m.id} className="flex items-start gap-2 text-sm">
                      {m.completed_at ? (
                        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                      ) : (
                        <Circle
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        />
                      )}
                      <span
                        className={
                          m.completed_at ? "text-muted-foreground line-through" : undefined
                        }
                      >
                        <span className="sr-only">{m.completed_at ? "Done: " : "Open: "}</span>
                        {m.title}
                      </span>
                      {m.due_date && !m.completed_at && (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {relativeDateLabel(m.due_date, ctx.today)}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          )}

          <Section
            title="Linked notes"
            count={notes.length || undefined}
            divider
            actions={
              <Link href="/notes" className="text-accent hover:underline">
                All notes
              </Link>
            }
          >
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No notes linked yet. Open a note and choose this project under &ldquo;Linked
                to&rdquo;.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {notes.map((n) => (
                  <li key={n.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/notes/${n.id}`}
                        className="min-w-0 truncate text-sm font-medium hover:underline"
                      >
                        {n.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(dateOfInstant(n.updated_at, ctx.timezone), "short")}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {n.body.replace(/\s+/g, " ").slice(0, 280)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside aria-label="Project details" className="min-w-0 space-y-8">
          <Section
            title="Focus time"
            variant="label"
            actions={
              <Link
                href={`/focus?project=${project.id}`}
                className="text-xs text-accent hover:underline"
              >
                Focus on this project
              </Link>
            }
          >
            {focus.available ? (
              <dl className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["Today", focusTime.todaySeconds],
                    ["This week", focusTime.weekSeconds],
                    ["Total", focusTime.totalSeconds],
                  ] as const
                ).map(([label, seconds]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {formatDuration(seconds)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">
                Focus time per project appears once the database update (migration 20261107090000)
                is applied.
              </p>
            )}
          </Section>
          <Section title="Details" variant="label" divider>
            <ProjectEditForm project={project} areas={lookups.areas} />
          </Section>
          {/* The picker carries its own "Goal" label; no section heading on top of it. */}
          <div className="border-t border-border pt-6">
            <GoalSelect
              kind="project"
              targetId={project.id}
              goalId={project.goal_id}
              goals={detail.goalOptions}
            />
          </div>
          <div className="border-t border-border pt-6">
            <DeleteProjectButton
              projectId={project.id}
              name={project.name}
              taskCount={open.length + finished.length}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
