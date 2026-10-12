import Link from "next/link";
import type { ReactNode } from "react";
import type { IsoDate } from "@/lib/dates";
import type { TaskView } from "@/features/tasks/queries";
import { cn } from "@/lib/utils";
import { TaskCheckbox } from "./task-checkbox";
import { TaskMeta } from "./task-meta";

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
    <li className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="pt-0.5">
        <TaskCheckbox taskId={task.id} title={task.title} status={task.status} />
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
