import { Flag } from "lucide-react";
import Link from "next/link";
import { plannerHref } from "@/features/planning/view";
import { formatMinutes, type AgendaItem } from "@/features/tasks/today-logic";
import type { IsoDate } from "@/lib/dates";
import { formatTimeRange, instantToLocal } from "@/lib/dates/zoned";
import { cn } from "@/lib/utils";

/**
 * Today's schedule as a timeline: time blocks (scheduled work), timed deadlines, free time between
 * things still to come, and a "now" marker. Deadlines and scheduled time are drawn differently on
 * purpose: one is when something is due, the other is when you plan to work on it. Editing blocks
 * happens in the Planner.
 */
export function DayAgenda({
  items,
  timezone,
  today,
}: {
  items: AgendaItem[];
  timezone: string;
  today: IsoDate;
}) {
  const dayHref = plannerHref("day", today);
  const hasEntries = items.some((i) => i.kind === "block" || i.kind === "deadline");
  if (!hasEntries) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing scheduled.{" "}
        <Link href={dayHref} className="text-link">
          Give your priorities time on the timeline
        </Link>
        .
      </p>
    );
  }
  const time = (instant: string) => instantToLocal(instant, timezone).time;

  return (
    <ol aria-label="Today's schedule" className="relative space-y-1">
      {items.map((item, index) => {
        switch (item.kind) {
          case "now":
            return (
              <li
                key={`now-${index}`}
                className="flex items-center gap-2 py-1"
                aria-label={`Now, ${time(item.at)}`}
              >
                <span className="w-[4.75rem] shrink-0 text-xs font-medium text-danger tabular-nums">
                  {time(item.at)}
                </span>
                <span aria-hidden className="h-px flex-1 bg-danger/50" />
              </li>
            );
          case "gap":
            return (
              <li
                key={`gap-${item.start}`}
                className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground"
              >
                <span className="w-[4.75rem] shrink-0 tabular-nums">{time(item.start)}</span>
                <span className="flex flex-1 items-center justify-between gap-2 rounded-md border border-dashed border-border px-2 py-1">
                  <span>Free · {formatMinutes(item.minutes)}</span>
                  <Link href={dayHref} className="text-link">
                    Plan it
                  </Link>
                </span>
              </li>
            );
          case "deadline":
            return (
              <li key={`deadline-${item.id}`} className="flex items-start gap-2 py-1 text-sm">
                <span className="w-[4.75rem] shrink-0 pt-px text-xs text-muted-foreground tabular-nums">
                  {time(item.at)}
                </span>
                <span className="flex min-w-0 flex-1 items-start gap-1.5">
                  <Flag
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      item.past && !item.done ? "text-danger" : "text-muted-foreground",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="sr-only">Deadline: </span>
                    <Link
                      href={`/tasks/${item.id}`}
                      className={cn(
                        "break-words hover:underline",
                        item.done && "text-muted-foreground line-through",
                      )}
                    >
                      {item.title}
                    </Link>
                    <span className="ml-1 text-xs text-muted-foreground">due</span>
                  </span>
                </span>
              </li>
            );
          case "block":
            return (
              <li
                key={`block-${item.id}`}
                aria-current={item.state === "current" ? "time" : undefined}
                className="flex items-start gap-2 text-sm"
              >
                <span className="w-[4.75rem] shrink-0 pt-1.5 text-xs text-muted-foreground tabular-nums">
                  {formatTimeRange(item.start, item.end, timezone)}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 rounded-md border-l-[3px] px-2.5 py-1.5",
                    item.state === "current"
                      ? "border-accent bg-accent-soft"
                      : item.state === "past"
                        ? "border-border bg-surface-muted/60 text-muted-foreground"
                        : "border-accent/60 bg-surface-muted",
                  )}
                >
                  {item.state === "current" && (
                    <span className="label-caps mr-1.5 text-accent">Now</span>
                  )}
                  {item.taskId ? (
                    <Link
                      href={`/tasks/${item.taskId}`}
                      className={cn("break-words hover:underline", item.done && "line-through")}
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <span className="break-words">{item.title}</span>
                  )}
                </span>
              </li>
            );
        }
      })}
    </ol>
  );
}
