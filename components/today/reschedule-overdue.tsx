"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { moveTaskDeadlines } from "@/features/tasks/actions";
import type { IsoDate } from "@/lib/dates";

/**
 * The explicit carry-forward step for overdue work: move every overdue deadline to today in one
 * action, with Undo restoring each original date. Nothing moves unless you choose this (per-task
 * moves are in each row's menu).
 */
export function RescheduleOverdue({
  tasks,
  today,
}: {
  tasks: { id: string; due_date: IsoDate | null }[];
  today: IsoDate;
}) {
  const [pending, startTransition] = useTransition();
  if (tasks.length === 0) return null;

  const move = () =>
    startTransition(async () => {
      const originals = tasks.map((t) => ({ id: t.id, due: t.due_date }));
      const result = await moveTaskDeadlines(tasks.map((t) => ({ id: t.id, due: today })));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { moved, failed } = result.data;
      toast.success(
        `Moved ${moved} deadline${moved === 1 ? "" : "s"} to today${failed ? ` (${failed} couldn't be moved)` : ""}`,
        {
          action: {
            label: "Undo",
            onClick: async () => {
              const undo = await moveTaskDeadlines(originals);
              if (!undo.ok) toast.error(undo.error);
            },
          },
        },
      );
    });

  return (
    <Button variant="ghost" size="xs" onClick={move} disabled={pending}>
      {pending ? "Moving…" : "Move all to today"}
    </Button>
  );
}
