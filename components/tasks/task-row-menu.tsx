"use client";

import {
  CalendarClock,
  CalendarMinus,
  CalendarPlus,
  MoreHorizontal,
  PanelRight,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { moveTaskDeadline } from "@/features/tasks/actions";
import { addDays, formatDate, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { safeAction } from "@/lib/safe-action";

/**
 * Row actions for a task: open it, or move its deadline in one step. Moving a deadline is always
 * an explicit choice (never automatic) and can be undone from the toast.
 */
export function TaskRowMenu({
  taskId,
  title,
  dueDate,
  today,
  finished,
}: {
  taskId: string;
  title: string;
  dueDate: IsoDate | null;
  today: IsoDate;
  finished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const move = (next: IsoDate | null) =>
    startTransition(async () => {
      const result = await safeAction(() => moveTaskDeadline(taskId, next));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? `Due ${formatDate(next, "short")}` : "Due date removed", {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await safeAction(() => moveTaskDeadline(taskId, dueDate));
            if (!undo.ok) toast.error(undo.error);
          },
        },
      });
    });

  const choices: { label: string; date: IsoDate; icon: typeof Sun }[] = [
    { label: "Due today", date: today, icon: Sun },
    { label: "Due tomorrow", date: addDays(today, 1), icon: CalendarPlus },
    { label: "Due in a week", date: addDays(today, 7), icon: CalendarClock },
  ];

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for “${title}”`}
          disabled={pending}
          className={cn(
            "rounded-md p-1 text-muted-foreground transition-opacity duration-150 hover:bg-surface-muted hover:text-foreground",
            // Revealed on row hover or keyboard focus; always visible on touch screens.
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
          )}
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => router.push(`/tasks/${taskId}`)}>
          <PanelRight aria-hidden />
          Open
        </MenuItem>
        {!finished && (
          <>
            <MenuSeparator />
            {choices
              .filter((c) => c.date !== dueDate)
              .map((c) => (
                <MenuItem key={c.label} onSelect={() => move(c.date)}>
                  <c.icon aria-hidden />
                  {c.label}
                </MenuItem>
              ))}
            {dueDate && (
              <MenuItem onSelect={() => move(null)}>
                <CalendarMinus aria-hidden />
                Remove due date
              </MenuItem>
            )}
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
