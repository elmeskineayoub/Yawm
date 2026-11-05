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
}: {
  task: TaskView;
  today: IsoDate;
  showProject?: boolean;
  actions?: ReactNode;
}) {
  const finished = task.status === "done" || task.status === "cancelled";
  return (
    <li className="group flex items-start gap-3 border-b border-border py-2 last:border-b-0">
      <div className="pt-[0.1875rem]">
        <TaskCheckbox
          taskId={task.id}
          title={task.title}
          status={task.status}
          priority={task.priority}
          recurring={task.recurrence_frequency !== null}
        />
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.id}`}
          className={cn(
            "block text-sm break-words hover:underline",
            finished && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </Link>
        <TaskMeta task={task} today={today} showProject={showProject} />
      </div>
      {actions}
      <TaskRowMenu
        taskId={task.id}
        title={task.title}
        dueDate={task.due_date}
        today={today}
        finished={finished}
      />
    </li>
  );
}

export function TaskList({
  tasks,
  today,
  showProject,
  label,
}: {
  tasks: TaskView[];
  today: IsoDate;
  showProject?: boolean;
  label: string;
}) {
  return (
    <ul aria-label={label}>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} today={today} showProject={showProject} />
      ))}
    </ul>
  );
}
