"use client";

import { ArrowRight, CalendarMinus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";
import { Button } from "@/components/ui/button";
import { moveTaskDeadline, moveTaskDeadlines } from "@/features/tasks/actions";
import type { CarriedTask } from "@/features/reviews/queries";
import { formatDate, type IsoDate } from "@/lib/dates";
import { safeAction } from "@/lib/safe-action";

/**
 * The Decide step for unfinished work: for each open task due in the reviewed week, finish it,
 * move it to `target` (the start of the next week, never a day already past), or drop its date.
 * Nothing moves unless you choose it, and every move can be undone from the toast.
 */
export function CarryForward({
  tasks,
  total,
  target,
}: {
  tasks: CarriedTask[];
  total: number;
  target: IsoDate;
}) {
  const [pending, startTransition] = useTransition();
  const when = formatDate(target, "short");

  const run = (
    moves: { id: string; due: IsoDate | null }[],
    message: string,
    originals: { id: string; due: IsoDate | null }[],
  ) =>
    startTransition(async () => {
      const result =
        moves.length === 1
          ? await safeAction(() => moveTaskDeadline(moves[0]!.id, moves[0]!.due))
          : await safeAction(() => moveTaskDeadlines(moves));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await safeAction(() => moveTaskDeadlines(originals));
            if (!undo.ok) toast.error(undo.error);
          },
        },
      });
    });

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing left open from this week. Every deadline was met or moved.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {total} open task{total === 1 ? "" : "s"} had a deadline this week. Finish, move, or let
          go of each one.
        </p>
        {tasks.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                tasks.map((t) => ({ id: t.id, due: target })),
                `Moved ${tasks.length} tasks to ${when}`,
                tasks.map((t) => ({ id: t.id, due: t.due_date })),
              )
            }
          >
            Move all to {when}
          </Button>
        )}
      </div>
      <ul
        aria-label="Unfinished this week"
        className="divide-y divide-border border-y border-border"
      >
        {tasks.map((t) => (
          <li key={t.id} className="group flex items-center gap-3 py-2">
            <TaskCheckbox taskId={t.id} title={t.title} status={t.status} />
            <div className="min-w-0 flex-1">
              <Link href={`/tasks/${t.id}`} className="block truncate text-sm hover:underline">
                {t.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                Was due {formatDate(t.due_date, "short")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="xs"
              disabled={pending}
              aria-label={`Move “${t.title}” to ${when}`}
              onClick={() =>
                run([{ id: t.id, due: target }], `Moved to ${when}`, [
                  { id: t.id, due: t.due_date },
                ])
              }
            >
              <ArrowRight aria-hidden className="size-3.5" />
              {when}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={pending}
              aria-label={`Remove the due date from “${t.title}”`}
              title="Keep the task, without a deadline"
              onClick={() =>
                run([{ id: t.id, due: null }], "Due date removed", [{ id: t.id, due: t.due_date }])
              }
            >
              <CalendarMinus aria-hidden className="size-3.5" />
              <span className="sr-only sm:not-sr-only">No date</span>
            </Button>
          </li>
        ))}
      </ul>
      {total > tasks.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing the first {tasks.length} of {total}.{" "}
          <Link href="/tasks" className="text-accent hover:underline">
            See all in Tasks
          </Link>
        </p>
      )}
    </div>
  );
}
