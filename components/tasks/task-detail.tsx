import Link from "next/link";
import { Section } from "@/components/ui/section";
import { plannerHref } from "@/features/planning/view";
import type { TaskDetail } from "@/features/tasks/detail";
import { describeRecurrence, STATUS_LABELS } from "@/features/tasks/logic";
import { dateOfInstant, formatDate, formatPeriod } from "@/lib/dates";
import { formatTimeRange, instantToLocal } from "@/lib/dates/zoned";
import { cn } from "@/lib/utils";
import { DeleteTaskButton } from "./delete-task-button";
import { DependencyEditor } from "./dependency-editor";
import { QuickAddTask } from "./quick-add-task";
import { TaskCheckbox } from "./task-checkbox";
import {
  TaskDescriptionField,
  TaskProperties,
  TaskRepeatField,
  TaskSaveIndicator,
  TaskSaveProvider,
  TaskTitleField,
} from "./task-editor";
import { TaskList } from "./task-row";

/**
 * The task, edited in place. Used by the full task page and by the side panel that opens over the
 * current page (app/(app)/@panel). Every field saves on its own; see task-editor.tsx.
 */
export function TaskDetailView({
  detail,
  today,
  timezone,
  variant,
}: {
  detail: TaskDetail;
  today: string;
  timezone: string;
  variant: "page" | "panel";
}) {
  const { task } = detail;
  const recurrence = describeRecurrence(task);
  const isSubtask = task.parent_task_id !== null;

  const header = (
    <div className="flex items-start gap-3">
      <div className={variant === "page" ? "pt-2.5" : "pt-1.5"}>
        <TaskCheckbox
          taskId={task.id}
          title={task.title}
          status={task.status}
          priority={task.priority}
          recurring={task.recurrence_frequency !== null}
        />
      </div>
      <TaskTitleField
        taskId={task.id}
        title={task.title}
        className={cn(
          variant === "page" ? "page-title" : "text-lg font-semibold leading-snug",
          (task.status === "done" || task.status === "cancelled") &&
            "text-muted-foreground line-through",
        )}
      />
    </div>
  );

  const meta = (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-8 text-sm text-muted-foreground">
      <span>{STATUS_LABELS[task.status]}</span>
      {task.completed_at && (
        <span>
          · completed{" "}
          {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: timezone }).format(
            new Date(task.completed_at),
          )}
        </span>
      )}
      {recurrence && <span>· {recurrence}</span>}
      {task.recurs_from_task_id && (
        <span>
          ·{" "}
          <Link href={`/tasks/${task.recurs_from_task_id}`} className="hover:underline">
            previous occurrence
          </Link>
        </span>
      )}
      <span className="ml-auto">
        <TaskSaveIndicator />
      </span>
    </p>
  );

  return (
    <TaskSaveProvider>
      <div className="space-y-8">
        <div>
          {header}
          {meta}
        </div>

        <TaskProperties
          taskId={task.id}
          status={task.status}
          priority={task.priority}
          dueDate={task.due_date}
          dueTime={task.due_time}
          estimateMinutes={task.estimate_minutes}
          projectId={task.project_id}
          areaId={task.area_id}
          goalId={task.goal_id}
          tagNames={detail.tagNames}
          projects={detail.lookups.projects}
          areas={detail.lookups.areas}
          goals={detail.goals}
          tagSuggestions={detail.lookups.tags.map((t) => t.name)}
          showGoal={!isSubtask}
        />

        <TaskDescriptionField taskId={task.id} description={task.description} />

        <TaskRepeatField
          taskId={task.id}
          frequency={task.recurrence_frequency}
          interval={task.recurrence_interval}
          weekdays={task.recurrence_weekdays}
          until={task.recurrence_until}
          hasDueDate={task.due_date !== null}
        />

        {!isSubtask && (
          <Section
            title="Subtasks"
            variant="label"
            count={detail.subtasks.length || undefined}
            divider
          >
            {detail.subtasks.length > 0 && (
              <TaskList
                tasks={detail.subtasks}
                today={today}
                label="Subtasks"
                showProject={false}
              />
            )}
            <div className="mt-2">
              <QuickAddTask parentTaskId={task.id} placeholder="Add a subtask" compact />
            </div>
          </Section>
        )}

        <Section title="Waiting on" variant="label" divider>
          <DependencyEditor
            taskId={task.id}
            dependsOn={detail.dependsOn}
            candidates={detail.candidates}
          />
          {detail.blocks.length > 0 && (
            <div className="mt-4">
              <h3 className="label-caps mb-1">Blocks</h3>
              <ul className="space-y-1 text-sm">
                {detail.blocks.map((b) => (
                  <li key={b.id}>
                    <Link href={`/tasks/${b.id}`} className="break-words hover:underline">
                      {b.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section
          title="Scheduled time"
          variant="label"
          description="Time set aside to work on it. Separate from the deadline."
          divider
        >
          {detail.scheduledBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet.{" "}
              <Link href={plannerHref("day", today)} className="text-accent hover:underline">
                Schedule it in the Planner
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {detail.scheduledBlocks.map((b) => {
                const local = instantToLocal(b.starts_at, timezone);
                return (
                  <li key={b.id}>
                    <Link href={plannerHref("day", local.date)} className="hover:underline">
                      {formatDate(local.date, "short")} ·{" "}
                      {formatTimeRange(b.starts_at, b.ends_at, timezone)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="In plans" variant="label" divider>
          {detail.plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not linked to a plan. Add it from the{" "}
              <Link href="/planner" className="text-accent hover:underline">
                Planner
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {detail.plans.map((p) => (
                <li key={p.id}>
                  <Link href={plannerHref(p.period, p.period_start)} className="hover:underline">
                    {formatPeriod(p.period, p.period_start)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <span>Created {formatDate(dateOfInstant(task.created_at, timezone))}</span>
          <DeleteTaskButton
            taskId={task.id}
            title={task.title}
            subtaskCount={detail.subtasks.length}
            redirectTo={
              variant === "panel"
                ? "back"
                : task.parent_task_id
                  ? `/tasks/${task.parent_task_id}`
                  : "/tasks"
            }
          />
        </div>
      </div>
    </TaskSaveProvider>
  );
}
