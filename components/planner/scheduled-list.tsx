import Link from "next/link";
import type { CalendarBlock } from "@/features/calendar/queries";
import { formatTimeRange } from "@/lib/dates/zoned";
import { cn } from "@/lib/utils";

/** Compact list of today's time blocks for Today and the Dashboard. */
export function ScheduledList({
  blocks,
  timezone,
  dayHref,
}: {
  blocks: CalendarBlock[];
  timezone: string;
  dayHref: string;
}) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing scheduled.{" "}
        <Link href={dayHref} className="text-accent hover:underline">
          Plan time for your priorities
        </Link>
        .
      </p>
    );
  }
  return (
    <ul aria-label="Scheduled today" className="space-y-1">
      {blocks.map((b) => (
        <li key={b.id} className="flex gap-3 text-sm">
          <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
            {formatTimeRange(b.starts_at, b.ends_at, timezone)}
          </span>
          {b.task ? (
            <Link
              href={`/tasks/${b.task.id}`}
              className={cn(
                "min-w-0 break-words hover:underline",
                b.task.status === "done" && "text-muted-foreground line-through",
              )}
            >
              {b.title}
            </Link>
          ) : (
            <span className="min-w-0 break-words">{b.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
