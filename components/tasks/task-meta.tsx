import { Ban, GitBranch, Lock, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { relativeDateLabel, type IsoDate } from "@/lib/dates";
import { isOverdue, PRIORITY_LABELS, STATUS_LABELS } from "@/features/tasks/logic";
import type { TaskView } from "@/features/tasks/queries";

export function TaskMeta({
  task,
  today,
  showProject = true,
}: {
  task: TaskView;
  today: IsoDate;
  showProject?: boolean;
}) {
  const overdue = isOverdue(task, today);
  const dueToday = task.due_date === today && task.status !== "done";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {task.priority === "urgent" || task.priority === "high" ? (
        <Badge tone={task.priority === "urgent" ? "danger" : "warning"}>
          {PRIORITY_LABELS[task.priority]}
        </Badge>
      ) : null}
      {task.status === "in_progress" && <Badge tone="info">{STATUS_LABELS.in_progress}</Badge>}
      {task.status === "cancelled" && (
        <Badge>
          <Ban aria-hidden className="size-3" /> Cancelled
        </Badge>
      )}
      {task.due_date && (
        <Badge tone={overdue ? "danger" : dueToday ? "warning" : "neutral"}>
          {overdue ? "Overdue · " : ""}
          {relativeDateLabel(task.due_date, today)}
          {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}
        </Badge>
      )}
      {task.recurrence_frequency && (
        <span title="Repeats" className="inline-flex items-center">
          <Repeat aria-label="Repeats" className="size-3.5" />
        </span>
      )}
      {task.openBlockers > 0 && (
        <Badge tone="warning">
          <Lock aria-hidden className="size-3" /> Blocked by {task.openBlockers}
        </Badge>
      )}
      {task.subtasks.total > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <GitBranch aria-hidden className="size-3" />
          <span className="sr-only">Subtasks:</span>
          {task.subtasks.done}/{task.subtasks.total}
        </span>
      )}
      {task.estimate_minutes && <span>{formatMinutes(task.estimate_minutes)}</span>}
      {showProject && task.project && <span>· {task.project.name}</span>}
      {task.area && (
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: task.area.color }}
          />
          {task.area.name}
        </span>
      )}
      {task.tags.map((tag) => (
        <span key={tag.id}>#{tag.name}</span>
      ))}
    </div>
  );
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
