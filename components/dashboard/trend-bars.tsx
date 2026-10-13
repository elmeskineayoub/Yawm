import type { DayCount } from "@/features/dashboard/logic";
import { formatDate } from "@/lib/dates";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "narrow" });

function weekdayLetter(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return WEEKDAY.format(new Date(Date.UTC(y, m - 1, d)));
}

/** A tiny, library-free bar strip of completed tasks per day. Heights are relative to the busiest day. */
export function TrendBars({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div
      className="flex items-end gap-1"
      role="img"
      aria-label="Completed tasks per day, last 7 days"
    >
      {days.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-16 w-full items-end" title={`${formatDate(d.date)}: ${d.count}`}>
            <div
              className="w-full rounded-sm bg-accent/80"
              style={{ height: `${Math.round((d.count / max) * 100)}%` }}
              aria-hidden
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{weekdayLetter(d.date)}</span>
        </div>
      ))}
    </div>
  );
}
