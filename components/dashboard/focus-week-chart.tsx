import type { FocusDay } from "@/features/dashboard/model";
import { formatDuration } from "@/features/focus/logic";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return WEEKDAY.format(new Date(Date.UTC(y, m - 1, d)));
}

/** The scale never drops below an hour, so a light week doesn't draw as a full one. */
const MIN_SCALE_SECONDS = 3600;

/**
 * Focus time per day of the current week: one series, so no legend (the heading names it). Bars are
 * anchored to a shared baseline with rounded data ends; today is the solid bar and its label is
 * bold, so it isn't marked by colour alone. Days still ahead show only the empty track. Hover or
 * focus a day for its exact time; the values are also in a screen-reader table.
 */
export function FocusWeekChart({ days }: { days: FocusDay[] }) {
  const max = Math.max(MIN_SCALE_SECONDS, ...days.map((d) => d.seconds));
  return (
    <figure>
      <div className="flex h-24 items-end gap-0.5" aria-hidden>
        {days.map((d) => {
          const height = d.isFuture ? 0 : Math.round((d.seconds / max) * 100);
          return (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
            >
              <span
                className={cn(
                  "pointer-events-none mb-1 text-caption text-muted-foreground tabular-nums",
                  d.isToday
                    ? "opacity-100"
                    : "opacity-0 transition-opacity group-hover:opacity-100",
                )}
              >
                {d.isFuture ? "" : formatDuration(d.seconds)}
              </span>
              <div className="flex h-full w-full max-w-5 items-end overflow-hidden rounded-t-bar bg-surface-muted">
                <div
                  className={cn(
                    "w-full rounded-t-bar transition-[height] duration-300",
                    d.isToday ? "bg-accent" : "bg-muted-foreground/60",
                  )}
                  style={{ height: `${height}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-0.5" aria-hidden>
        {days.map((d) => (
          <span
            key={d.date}
            className={cn(
              "flex-1 text-center text-caption",
              d.isToday ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {weekday(d.date).charAt(0)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Focus time per day this week</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Focus</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">
                {formatDate(d.date)}
                {d.isToday ? " (today)" : ""}
              </th>
              <td>{d.isFuture ? "Not yet" : formatDuration(d.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
