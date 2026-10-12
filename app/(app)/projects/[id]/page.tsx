import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectEditForm } from "@/components/projects/project-edit-form";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskList } from "@/components/tasks/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PROJECT_STATUS_LABELS } from "@/features/projects/schemas";
import { compareTasks, isOpen, progressOf } from "@/features/tasks/logic";
import { enrichTasks, loadLookups, TASK_COLUMNS } from "@/features/tasks/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await getWorkspaceContext();
  const { supabase } = ctx;

  const [project, taskRows, lookups] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("tasks").select(TASK_COLUMNS).eq("project_id", id).limit(1000),
    loadLookups(ctx),
  ]);
  if (project.error || taskRows.error) throw new Error("Could not load the project.");
  if (!project.data) notFound();

  const tasks = await enrichTasks(ctx, taskRows.data, lookups);
  const open = tasks.filter((t) => isOpen(t.status)).sort(compareTasks("due"));
  const finished = tasks
    .filter((t) => !isOpen(t.status))
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const progress = progressOf(tasks);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:underline">
          Projects
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight break-words">{project.data.name}</h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        {PROJECT_STATUS_LABELS[project.data.status]}
      </p>
      <div className="mb-6 max-w-md">
        <ProgressBar progress={progress} label="Project progress" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="project-tasks" className="space-y-3">
          <h2 id="project-tasks" className="text-sm font-semibold">
            Tasks
          </h2>
          <QuickAddTask projectId={project.data.id} placeholder="Add a task to this project" />
          {open.length === 0 ? (
            <EmptyState title="No open tasks">Add the next step above.</EmptyState>
          ) : (
            <TaskList tasks={open} today={ctx.today} label="Open tasks" showProject={false} />
          )}
          {finished.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
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
        </section>

        <div className="space-y-6">
          <section
            aria-label="Project details"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <ProjectEditForm project={project.data} areas={lookups.areas} />
          </section>
          <DeleteProjectButton
            projectId={project.data.id}
            name={project.data.name}
            taskCount={tasks.length}
          />
        </div>
      </div>
    </>
  );
}
