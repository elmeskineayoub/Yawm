"use client";

import Link from "next/link";
import { useState, useTransition, type DragEvent } from "react";
import { toast } from "sonner";
import type { IsoDate } from "@/lib/dates";
import { setTaskStatus } from "@/features/tasks/actions";
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/features/tasks/logic";
import type { TaskView } from "@/features/tasks/queries";
import { cn } from "@/lib/utils";
import { StatusSelect } from "./status-select";
import { TaskMeta } from "./task-meta";
import { safeAction } from "@/lib/safe-action";

const DRAG_TYPE = "application/x-yawm-task";

/**
 * Kanban board: a column per status. Drag a card to another column to change its status; the card
 * moves at once and snaps back, with the reason, if the server refuses (for example a task blocked
 * by an unfinished dependency). The status menu on each card does the same from the keyboard or a
 * touch screen, where drag and drop is not available.
 */
export function TaskBoard({ tasks, today }: { tasks: TaskView[]; today: IsoDate }) {
  // Moves the server has not confirmed yet (or just confirmed, until fresh data arrives).
  const [moved, setMoved] = useState<Record<string, TaskStatus>>({});
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();
  const statusOf = (task: TaskView) => moved[task.id] ?? task.status;

  const move = (task: TaskView, next: TaskStatus) => {
    if (statusOf(task) === next) return;
    setMoved((m) => ({ ...m, [task.id]: next }));
    startTransition(async () => {
      const result = await safeAction(() => setTaskStatus(task.id, next));
      if (!result.ok) {
        setMoved((m) => {
          const rest = { ...m };
          delete rest[task.id];
          return rest;
        });
        toast.error(result.error);
      }
    });
  };

  const onDrop = (event: DragEvent, status: TaskStatus) => {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    const task = tasks.find((t) => t.id === id);
    if (task) move(task, status);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const column = tasks.filter((t) => statusOf(t) === status);
        return (
          <section
            key={status}
            aria-labelledby={`col-${status}`}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== status) setOver(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
            }}
            onDrop={(e) => onDrop(e, status)}
            className={cn(
              "rounded-lg border bg-surface-muted/50 p-3 transition-colors duration-150",
              over === status ? "border-accent bg-accent-soft" : "border-transparent",
            )}
          >
            <h2
              id={`col-${status}`}
              className="mb-2 flex items-center justify-between px-1 text-sm font-semibold"
            >
              {STATUS_LABELS[status]}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {column.length}
              </span>
            </h2>
            {column.length === 0 ? (
              <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                Drop a task here
              </p>
            ) : (
              <ul className="space-y-2">
                {column.map((task) => (
                  <li
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE, task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn(
                      "cursor-grab rounded-md border border-border bg-surface p-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] active:cursor-grabbing",
                      moved[task.id] && moved[task.id] !== task.status && "opacity-70",
                    )}
                  >
                    <Link
                      href={`/tasks/${task.id}`}
                      draggable={false}
                      className="text-sm break-words hover:underline"
                    >
                      {task.title}
                    </Link>
                    <TaskMeta task={task} today={today} />
                    <div className="mt-2">
                      <StatusSelect
                        taskId={task.id}
                        title={task.title}
                        status={statusOf(task)}
                        onChange={(next) => move(task, next)}
                      />
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
