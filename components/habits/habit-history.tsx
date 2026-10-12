"use client";

import * as Popover from "@radix-ui/react-popover";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logHabit } from "@/features/habits/actions";
import type { DayStatus, HabitLog } from "@/features/habits/logic";
import type { LogEntry } from "@/features/habits/schemas";
import { formatDate, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { statusClass } from "./habit-row";

export type HistoryCell = { date: IsoDate; status: DayStatus; log: HabitLog | null };

const STATUS_TEXT: Record<DayStatus, string> = {
  done: "Done",
  rest: "Rest day",
  missed: "Missed",
  open: "Not done",
  inactive: "Not active",
};

/**
 * About twelve weeks as a grid (a column per week, a row per weekday). Any day up to today can
 * be corrected; streaks and rates recalculate from the edited history.
 */
export function HabitHistory({
  habitId,
  title,
  kind,
  target,
  unit,
  weeks,
  weekdayLabels,
  today,
}: {
  habitId: string;
  title: string;
  kind: "boolean" | "measurable";
  target: number | null;
  unit: string | null;
  weeks: HistoryCell[][];
  weekdayLabels: string[];
  today: IsoDate;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <caption className="sr-only">{title}: history by week</caption>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Day
            </th>
            {weeks.map((week) => (
              <th
                key={week[0]!.date}
                scope="col"
                className="text-[10px] font-normal text-muted-foreground"
              >
                <span aria-hidden>{Number(week[0]!.date.slice(8))}</span>
                <span className="sr-only">Week of {formatDate(week[0]!.date, "short")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekdayLabels.map((label, row) => (
            <tr key={label}>
              <th
                scope="row"
                className="pr-1 text-left text-[10px] font-normal text-muted-foreground"
              >
                {label}
              </th>
              {weeks.map((week) => {
                const cell = week[row]!;
                return (
                  <td key={cell.date}>
                    <DayCell
                      cell={cell}
                      habitId={habitId}
                      kind={kind}
                      target={target}
                      unit={unit}
                      future={cell.date > today}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
        {(["done", "rest", "missed", "open"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1">
            <span aria-hidden className={cn("size-3 rounded-sm border", statusClass[s])} />
            {STATUS_TEXT[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayCell({
  cell,
  habitId,
  kind,
  target,
  unit,
  future,
}: {
  cell: HistoryCell;
  habitId: string;
  kind: "boolean" | "measurable";
  target: number | null;
  unit: string | null;
  future: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(cell.log?.value?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const label = `${formatDate(cell.date)}: ${STATUS_TEXT[cell.status]}${
    cell.log?.value != null && kind === "measurable"
      ? ` (${cell.log.value}${unit ? ` ${unit}` : ""})`
      : ""
  }`;

  const save = (entry: LogEntry) =>
    startTransition(async () => {
      const result = await logHabit(habitId, cell.date, entry);
      if (!result.ok) toast.error(result.error);
      else setOpen(false);
    });

  if (future || cell.status === "inactive") {
    return (
      <span
        title={label}
        className={cn(
          "block size-4 rounded-sm border",
          statusClass[cell.status],
          future && "opacity-40",
        )}
      >
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${label}. Change`}
          title={label}
          className={cn(
            "block size-4 rounded-sm border focus-visible:outline-2 focus-visible:outline-accent",
            statusClass[cell.status],
          )}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          className="z-50 w-56 space-y-2 rounded-md border border-border bg-background p-3 text-sm shadow-lg"
        >
          <p className="font-medium">{formatDate(cell.date)}</p>
          {kind === "measurable" ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const value = Number(amount);
                if (amount.trim() === "" || !Number.isFinite(value) || value < 0) return;
                save({ type: "value", value });
              }}
            >
              <label className="sr-only" htmlFor={`amount-${cell.date}`}>
                Amount
              </label>
              <input
                id={`amount-${cell.date}`}
                type="number"
                min={0}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-20 rounded-md border border-border bg-background px-2 py-1"
              />
              <span className="text-xs text-muted-foreground">
                / {target} {unit}
              </span>
              <Button
                type="submit"
                variant="secondary"
                className="ml-auto px-2 py-1 text-xs"
                disabled={pending}
              >
                Save
              </Button>
            </form>
          ) : (
            <Button
              className="w-full py-1"
              disabled={pending}
              onClick={() => save({ type: "value", value: 1 })}
            >
              Done
            </Button>
          )}
          <div className="flex gap-1">
            <Button
              variant="secondary"
              className="flex-1 px-2 py-1 text-xs"
              disabled={pending}
              onClick={() => save({ type: "rest" })}
            >
              Rest day
            </Button>
            <Button
              variant="ghost"
              className="flex-1 px-2 py-1 text-xs"
              disabled={pending || !cell.log}
              onClick={() => save({ type: "clear" })}
            >
              Clear
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
