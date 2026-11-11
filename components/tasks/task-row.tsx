import Link from "next/link";
import type { ReactNode } from "react";
import type { IsoDate } from "@/lib/dates";
import type { TaskView } from "@/features/tasks/queries";
import { cn } from "@/lib/utils";
import { TaskCheckbox } from "./task-checkbox";
import { TaskMeta } from "./task-meta";
import { TaskRowMenu } from "./task-row-menu";

export function TaskRow({
  task,
  today,
  showProject,
  actions,
  comfortable = false,
}: {
  task: TaskView;
  today: IsoDate;
  showProject?: boolean;
  actions?: ReactNode;
  /**
   * Touch-comfortable row: on touch screens the checkbox, title, and menu each get a 44px target
   * (the row grows a little). Mouse layouts are unchanged.
   */
  comfortable?: boolean;
}) {
  const finished = task.status === "done" || task.status === "cancelled";
  return (
    <li className="group flex items-start gap-3 border-b border-border py-2 last:border-b-0">
      <div className={cn("pt-[0.1875rem]", comfortable && "pointer-coarse:pt-3.5")}>
        <TaskCheckbox
          comfortable={comfortable}
          taskId={task.id}
          title={task.title}
          status={task.status}
          priority={task.priority}
          recurring={task.recurrence_frequency !== null}
        />
      </div>
      <div className="min-w-0 flex-1">
        <Link
          data-nav-item
          href={`/tasks/${task.id}`}
          className={cn(
            "block text-sm break-words hover:underline",
            comfortable &&
              "pointer-coarse:flex pointer-coarse:min-h-tap pointer-coarse:items-center",
            finished && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </Link>
        <TaskMeta
          task={task}
          today={today}
          showProject={showProject}
          className={comfortable ? "pointer-coarse:mt-0" : undefined}
        />
      </div>
      {actions}
      <TaskRowMenu
        taskId={task.id}
        title={task.title}
        dueDate={task.due_date}
        today={today}
        finished={finished}
        comfortable={comfortable}
      />
    </li>
  );
}

export function TaskList({
  tasks,
  today,
  showProject,
  label,
  comfortable,
}: {
  tasks: TaskView[];
  today: IsoDate;
  showProject?: boolean;
  label: string;
  comfortable?: boolean;
}) {
  return (
    <ul aria-label={label}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          today={today}
          showProject={showProject}
          comfortable={comfortable}
        />
      ))}
    </ul>
  );
}
