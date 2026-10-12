import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DeleteTaskButton } from "@/components/tasks/delete-task-button";
import { DependencyEditor } from "@/components/tasks/dependency-editor";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskEditForm } from "@/components/tasks/task-edit-form";
import { TaskList } from "@/components/tasks/task-row";
import { describeRecurrence, STATUS_LABELS } from "@/features/tasks/logic";
import { enrichTasks, loadLookups, TASK_COLUMNS } from "@/features/tasks/queries";
import { dateOfInstant, formatDate, formatPeriod, type PlanPeriod } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await getWorkspaceContext();
  const { supabase } = ctx;
  const { data: task, error } = await supabase
    .from("tasks")
    .select(`${TASK_COLUMNS}, recurs_from_task_id`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load the task.");
  if (!task) notFound();

  const [
    lookups,
    subtaskRows,
    tagRows,
    dependsOnRows,
    blocksRows,
    planRows,
    candidateRows,
    parent,
  ] = await Promise.all([
    loadLookups(ctx),
    supabase.from("tasks").select(TASK_COLUMNS).eq("parent_task_id", id).order("created_at"),
    supabase.from("task_tags").select("tag_id").eq("task_id", id),
    supabase.from("task_dependencies").select("depends_on_task_id").eq("task_id", id),
    supabase.from("task_dependencies").select("task_id").eq("depends_on_task_id", id),
    supabase.from("plan_items").select("plan_id").eq("task_id", id),
    supabase
      .from("tasks")
      .select("id, title, status")
      .neq("id", id)
      .in("status", ["todo", "in_progress", "done"])
      .order("created_at", { ascending: false })
      .limit(300),
    task.parent_task_id
      ? supabase.from("tasks").select("id, title").eq("id", task.parent_task_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (subtaskRows.error || tagRows.error || dependsOnRows.error || blocksRows.error) {
    throw new Error("Could not load the task details.");
  }

  const relatedIds = [
    ...(dependsOnRows.data ?? []).map((d) => d.depends_on_task_id),
    ...(blocksRows.data ?? []).map((d) => d.task_id),
  ];
  const [related, plans] = await Promise.all([
    relatedIds.length
      ? supabase.from("tasks").select("id, title, status").in("id", relatedIds)
      : Promise.resolve({ data: [], error: null }),
    planRows.data?.length
      ? supabase
          .from("plans")
          .select("id, period, period_start")
          .in(
            "id",
            planRows.data.map((p) => p.plan_id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedById = new Map((related.data ?? []).map((t) => [t.id, t]));
  const dependsOn = (dependsOnRows.data ?? [])
    .map((d) => relatedById.get(d.depends_on_task_id))
    .filter((t) => t !== undefined);
  const blocks = (blocksRows.data ?? [])
    .map((d) => relatedById.get(d.task_id))
    .filter((t) => t !== undefined);

  const subtasks = await enrichTasks(ctx, subtaskRows.data, lookups);
  const tagIds = new Set((tagRows.data ?? []).map((t) => t.tag_id));
  const tagNames = lookups.tags.filter((t) => tagIds.has(t.id)).map((t) => t.name);
  const recurrence = describeRecurrence(task);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted-foreground">
        <Link href="/tasks" className="hover:underline">
          Tasks
        </Link>
        {parent.data && (
          <>
            {" / "}
            <Link href={`/tasks/${parent.data.id}`} className="hover:underline">
              {parent.data.title}
            </Link>
          </>
        )}
      </nav>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight break-words">{task.title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {STATUS_LABELS[task.status]}
        {task.completed_at &&
          ` · completed ${new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeZone: ctx.timezone,
          }).format(new Date(task.completed_at))}`}
        {recurrence && ` · ${recurrence}`}
        {task.recurs_from_task_id && (
          <>
            {" · "}
            <Link href={`/tasks/${task.recurs_from_task_id}`} className="hover:underline">
              previous occurrence
            </Link>
          </>
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          aria-label="Task details"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <TaskEditForm task={task} tagNames={tagNames} lookups={lookups} />
        </section>

        <div className="space-y-6">
          {!task.parent_task_id && (
            <section
              aria-labelledby="subtasks-heading"
              className="rounded-lg border border-border bg-surface p-5"
            >
              <h2 id="subtasks-heading" className="mb-2 text-sm font-semibold">
                Subtasks
              </h2>
              {subtasks.length > 0 && (
                <TaskList tasks={subtasks} today={ctx.today} label="Subtasks" showProject={false} />
              )}
              <div className="mt-2">
                <QuickAddTask parentTaskId={task.id} placeholder="Add a subtask" compact />
              </div>
            </section>
          )}

          <section
            aria-labelledby="deps-heading"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 id="deps-heading" className="mb-2 text-sm font-semibold">
              Waiting on
            </h2>
            <DependencyEditor
              taskId={task.id}
              dependsOn={dependsOn}
              candidates={(candidateRows.data ?? []).filter((c) => c.status !== "done")}
            />
            {blocks.length > 0 && (
              <>
                <h3 className="mt-4 mb-1 text-sm font-semibold">Blocks</h3>
                <ul className="space-y-1 text-sm">
                  {blocks.map((b) => (
                    <li key={b.id}>
                      <Link href={`/tasks/${b.id}`} className="break-words hover:underline">
                        {b.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section
            aria-labelledby="plans-heading"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 id="plans-heading" className="mb-2 text-sm font-semibold">
              In plans
            </h2>
            {(plans.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not linked to a plan. Add it from the{" "}
                <Link href="/planner" className="text-accent hover:underline">
                  Planner
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {(plans.data ?? []).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/planner?period=${p.period}&date=${p.period_start}`}
                      className="hover:underline"
                    >
                      {formatPeriod(p.period as PlanPeriod, p.period_start)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
            <p>Created {formatDate(dateOfInstant(task.created_at, ctx.timezone))}</p>
            <div className="mt-3">
              <DeleteTaskButton
                taskId={task.id}
                title={task.title}
                subtaskCount={subtasks.length}
                redirectTo={task.parent_task_id ? `/tasks/${task.parent_task_id}` : "/tasks"}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
