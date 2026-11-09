import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { monthGrid, weekdayInitials } from "@/features/journal/logic";
import { addMonths, formatDate, formatPeriod, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * A month calendar for the journal. Days with entries are marked and open the (first) entry of
 * that day; an empty day up to today starts a new entry for it. Months move with the arrows, and
 * the list below follows the month shown.
 */
export function DateNavigator({
  month,
  today,
  weekStart,
  entries,
  filtered,
}: {
  /** YYYY-MM */
  month: string;
  today: IsoDate;
  weekStart: number;
  /** Entry ids by date, for this month. */
  entries: Record<string, string[]>;
  /** True when the list below is limited to this month (so "All entries" is offered). */
  filtered: boolean;
}) {
  const first = `${month}-01` as IsoDate;
  const prev = addMonths(first, -1).slice(0, 7);
  const next = addMonths(first, 1).slice(0, 7);
  const thisMonth = today.slice(0, 7);
  const weeks = monthGrid(month, weekStart);
  const count = Object.values(entries).reduce((n, ids) => n + ids.length, 0);

  return (
    <nav aria-label="Journal dates">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href={`/journal?month=${prev}`}
          aria-label={`Previous month, ${formatPeriod("month", `${prev}-01`)}`}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Link>
        <p className="text-sm font-medium" aria-live="polite">
          {formatPeriod("month", first)}
          <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
            <span className="sr-only">, </span>
            {count}
            <span className="sr-only"> {count === 1 ? "entry" : "entries"}</span>
          </span>
        </p>
        {month < thisMonth ? (
          <Link
            href={`/journal?month=${next}`}
            aria-label={`Next month, ${formatPeriod("month", `${next}-01`)}`}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span className="p-1 opacity-30" aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
      <table className="w-full table-fixed border-collapse text-center text-xs">
        <caption className="sr-only">
          {formatPeriod("month", first)}: days with entries are marked
        </caption>
        <thead>
          <tr>
            {weekdayInitials(weekStart).map((d) => (
              <th key={d} scope="col" className="pb-1 font-normal text-muted-foreground">
                <abbr title={d} className="no-underline">
                  {d.slice(0, 2)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((date, d) => {
                if (!date) return <td key={d} />;
                const ids = entries[date] ?? [];
                const isToday = date === today;
                const future = date > today;
                const day = Number(date.slice(8));
                const cell = cn(
                  "mx-auto flex size-8 flex-col items-center justify-center rounded-full tabular-nums",
                  isToday && "ring-1 ring-accent",
                );
                return (
                  <td key={d} className="py-0.5">
                    {future ? (
                      <span className={cn(cell, "text-muted-foreground")}>{day}</span>
                    ) : ids.length > 0 ? (
                      <Link
                        href={`/journal/${ids[0]}`}
                        aria-label={`${formatDate(date)}: ${ids.length} entr${ids.length === 1 ? "y" : "ies"}`}
                        className={cn(
                          cell,
                          "bg-accent-soft font-medium text-accent hover:bg-accent/20",
                        )}
                      >
                        {day}
                        <span aria-hidden className="mt-px flex gap-0.5">
                          {ids.slice(0, 3).map((id) => (
                            <span key={id} className="size-1 rounded-full bg-accent" />
                          ))}
                        </span>
                      </Link>
                    ) : (
                      <Link
                        href={`/journal?month=${month}&date=${date}#new-entry`}
                        aria-label={`${formatDate(date)}: no entry. Write one`}
                        className={cn(cell, "text-foreground hover:bg-surface-muted")}
                      >
                        {day}
                      </Link>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex justify-between text-xs">
        {month !== thisMonth ? (
          <Link href={`/journal?month=${thisMonth}`} className="text-link">
            This month
          </Link>
        ) : (
          <span />
        )}
        {filtered && (
          <Link href="/journal" className="text-muted-foreground hover:underline">
            All entries
          </Link>
        )}
      </p>
    </nav>
  );
}
