import Link from "next/link";
import type { IsoDate } from "@/lib/dates";
import { STATUS_LABELS, TASK_STATUSES } from "@/features/tasks/logic";
import type { TaskView } from "@/features/tasks/queries";
import { StatusSelect } from "./status-select";
import { TaskMeta } from "./task-meta";

export function TaskBoard({ tasks, today }: { tasks: TaskView[]; today: IsoDate }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const column = tasks.filter((t) => t.status === status);
        return (
          <section
            key={status}
            aria-labelledby={`col-${status}`}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <h2
              id={`col-${status}`}
              className="mb-2 flex items-center justify-between text-sm font-semibold"
            >
              {STATUS_LABELS[status]}
              <span className="text-xs font-normal text-muted-foreground">{column.length}</span>
            </h2>
            {column.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No tasks</p>
            ) : (
              <ul className="space-y-2">
                {column.map((task) => (
                  <li key={task.id} className="rounded-md border border-border bg-background p-2.5">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-sm break-words hover:underline"
                    >
                      {task.title}
                    </Link>
                    <TaskMeta task={task} today={today} />
                    <div className="mt-2">
                      <StatusSelect taskId={task.id} title={task.title} status={task.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
