"use client";

import { Draggable } from "@fullcalendar/interaction";
import * as Popover from "@radix-ui/react-popover";
import { CalendarClock, GripVertical } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { defaultBlockMinutes } from "@/features/calendar/logic";
import type { SchedulableTask } from "@/features/calendar/queries";
import { linkToPlan } from "@/features/planning/actions";
import { moveTaskDeadline } from "@/features/tasks/actions";
import { addDays, relativeDateLabel, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const TRAY_LIMIT = 12;

/**
 * Open tasks without upcoming scheduled time. Drag one onto the calendar, or use "Schedule"
 * (keyboard and touch friendly) to pick a time.
 */
export function UnscheduledTray({
  tasks,
  priorityIds,
  today,
  onSchedule,
}: {
  tasks: SchedulableTask[];
  priorityIds: Set<string>;
  today: IsoDate;
  onSchedule: (task: SchedulableTask) => void;
}) {
  const id = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!listRef.current) return;
    const draggable = new Draggable(listRef.current, {
      itemSelector: "[data-drag-task]",
      eventData: (el) => ({
        title: el.getAttribute("data-title") ?? "",
        duration: { minutes: Number(el.getAttribute("data-minutes") ?? 30) },
        create: true,
        extendedProps: { kind: "task-drop", taskId: el.getAttribute("data-task-id") },
      }),
    });
    return () => draggable.destroy();
  }, []);

  const visible = showAll ? tasks : tasks.slice(0, TRAY_LIMIT);

  return (
    <section aria-labelledby={`${id}-h`}>
      <h2
        id={`${id}-h`}
        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        Unscheduled
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-1 px-1 text-sm text-muted-foreground">
          Every open task has time set aside. Add tasks from the priorities above or the Tasks page.
        </p>
      ) : (
        <>
          <p className="mt-1 px-1 text-xs text-muted-foreground">
            Drag onto the calendar, or choose Schedule.
          </p>
          <ul ref={listRef} aria-label="Unscheduled tasks" className="mt-1">
            {visible.map((task) => (
              <li
                key={task.id}
                data-drag-task
                data-task-id={task.id}
                data-title={task.title}
                data-minutes={defaultBlockMinutes(task.estimate_minutes)}
                className="group flex cursor-grab items-center gap-1.5 rounded-md px-1 py-1.5 hover:bg-surface-muted active:cursor-grabbing"
              >
                <GripVertical aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="block truncate text-sm hover:underline"
                  >
                    {task.title}
                  </Link>
                  <span className="flex gap-1.5 text-xs text-muted-foreground">
                    {priorityIds.has(task.id) && <span>Priority</span>}
                    {task.due_date && (
                      <span
                        className={cn(task.due_date < today && "text-red-700 dark:text-red-400")}
                      >
                        Due {relativeDateLabel(task.due_date, today)}
                      </span>
                    )}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => onSchedule(task)}
                  aria-label={`Schedule “${task.title}”`}
                >
                  Schedule
                </Button>
              </li>
            ))}
          </ul>
          {tasks.length > TRAY_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 px-1 text-xs text-accent hover:underline"
            >
              {showAll ? "Show fewer" : `Show all ${tasks.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Unfinished work that needs a decision. Nothing moves until the user chooses. */
export function RescheduleList({
  items,
  today,
  onSchedule,
}: {
  items: { task: SchedulableTask; reasons: ("missed_block" | "overdue")[] }[];
  today: IsoDate;
  onSchedule: (task: SchedulableTask) => void;
}) {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby={`${id}-h`}
      className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <h2 id={`${id}-h`} className="flex items-center gap-1.5 text-sm font-semibold">
        <CalendarClock aria-hidden className="size-4" />
        Needs rescheduling
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Unfinished work whose time or deadline has passed. Choose what to do with each.
      </p>
      <ul className="mt-2 space-y-2">
        {items.map(({ task, reasons }) => (
          <li key={task.id} className="text-sm">
            <Link href={`/tasks/${task.id}`} className="font-medium break-words hover:underline">
              {task.title}
            </Link>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {reasons.includes("missed_block") && (
                <Badge tone="warning">Scheduled time passed</Badge>
              )}
              {reasons.includes("overdue") && task.due_date && (
                <Badge tone="danger">Overdue · {relativeDateLabel(task.due_date, today)}</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => onSchedule(task)}
              >
                Schedule…
              </Button>
              {task.due_date && <MoveDeadline task={task} today={today} />}
              <PlanForToday taskId={task.id} today={today} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MoveDeadline({ task, today }: { task: SchedulableTask; today: IsoDate }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [pending, startTransition] = useTransition();

  const move = (next: IsoDate) =>
    startTransition(async () => {
      const result = await moveTaskDeadline(task.id, next);
      if (result.ok) {
        toast.success(`Deadline moved to ${relativeDateLabel(next, today)}`);
        setOpen(false);
      } else toast.error(result.error);
    });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="px-2 py-1 text-xs">
          Move deadline…
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          className="z-50 w-64 rounded-lg border border-border bg-background p-3 shadow-lg"
        >
          <p className="text-sm font-medium">New deadline for “{task.title}”</p>
          <div className="mt-2 flex gap-1">
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={pending}
              onClick={() => move(today)}
            >
              Today
            </Button>
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={pending}
              onClick={() => move(addDays(today, 1))}
            >
              Tomorrow
            </Button>
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={pending}
              onClick={() => move(addDays(today, 7))}
            >
              Next week
            </Button>
          </div>
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              move(date);
            }}
          >
            <label htmlFor={`${id}-date`} className="sr-only">
              Pick a date
            </label>
            <input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(controlClass, "py-1")}
            />
            <Button type="submit" className="px-2 py-1 text-xs" disabled={pending || !date}>
              Set
            </Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function PlanForToday({ taskId, today }: { taskId: string; today: IsoDate }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="px-2 py-1 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await linkToPlan("day", today, "task", taskId);
          if (result.ok) toast.success("Added to today's priorities");
          else toast.error(result.error);
        })
      }
    >
      Add to today
    </Button>
  );
}
