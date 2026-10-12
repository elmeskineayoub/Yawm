"use client";

import { Check, Moon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { logHabit } from "@/features/habits/actions";
import {
  describeSchedule,
  isDone,
  streakText,
  type DayStatus,
  type HabitLog,
} from "@/features/habits/logic";
import type { HabitSummary } from "@/features/habits/queries";
import type { LogEntry } from "@/features/habits/schemas";
import { formatDate, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<DayStatus, string> = {
  done: "done",
  rest: "rest day",
  missed: "missed",
  open: "not done",
  inactive: "not active",
};

export const statusClass: Record<DayStatus, string> = {
  done: "bg-accent border-accent",
  rest: "border-dashed border-muted-foreground/50",
  missed: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950",
  open: "border-border",
  inactive: "border-transparent bg-surface-muted/40",
};

function entryToLog(date: IsoDate, entry: LogEntry): HabitLog | null {
  if (entry.type === "clear") return null;
  return entry.type === "rest"
    ? { log_date: date, value: null, rest: true }
    : { log_date: date, value: entry.value, rest: false };
}

/** Records a habit for one day with an optimistic update that rolls back on failure. */
function useHabitLog(habitId: string, date: IsoDate, initial: HabitLog | null) {
  const [pending, startTransition] = useTransition();
  const [log, setLog] = useOptimistic(initial);
  const save = (entry: LogEntry) =>
    startTransition(async () => {
      setLog(entryToLog(date, entry));
      const result = await logHabit(habitId, date, entry);
      if (!result.ok) toast.error(result.error);
    });
  return { log, save, pending };
}

/** The last seven days as small squares, oldest first. */
export function RecentStrip({ recent, title }: { recent: HabitSummary["recent"]; title: string }) {
  return (
    <ol aria-label={`${title}, last 7 days`} className="flex gap-0.5">
      {recent.map((d) => (
        <li
          key={d.date}
          title={`${formatDate(d.date, "short")}: ${STATUS_LABEL[d.status]}`}
          className={cn("size-3 rounded-sm border", statusClass[d.status])}
        >
          <span className="sr-only">
            {formatDate(d.date, "short")}: {STATUS_LABEL[d.status]}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * One habit on one day: tick (yes/no habits) or an amount (measurable habits), plus a rest-day
 * toggle. Days after today are read-only.
 */
export function HabitRow({
  summary,
  date,
  today,
  showStrip = true,
}: {
  summary: HabitSummary;
  date: IsoDate;
  today: IsoDate;
  showStrip?: boolean;
}) {
  const { habit } = summary;
  const { log, save, pending } = useHabitLog(habit.id, date, summary.log);
  const done = isDone(habit, log ?? undefined);
  const future = date > today;
  const rest = log?.rest === true;

  return (
    <li className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      {habit.kind === "boolean" ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mark “${habit.title}” not done` : `Mark “${habit.title}” done`}
          disabled={pending || future}
          onClick={() => save(done ? { type: "clear" } : { type: "value", value: 1 })}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/60 hover:border-accent disabled:opacity-50",
            done && "border-accent bg-accent text-accent-foreground",
          )}
        >
          {done && <Check aria-hidden className="size-3" strokeWidth={3} />}
        </button>
      ) : (
        <AmountInput
          key={`${log?.value ?? ""}`}
          title={habit.title}
          value={log?.value ?? null}
          target={habit.target_value ?? 1}
          unit={habit.unit}
          done={done}
          disabled={pending || future}
          onSave={(value) => save(value === null ? { type: "clear" } : { type: "value", value })}
        />
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/habits/${habit.id}`}
          className={cn("block truncate text-sm hover:underline", done && "text-muted-foreground")}
        >
          {habit.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {summary.week
            ? `${summary.week.done} of ${summary.week.target || habit.times_per_week} this week`
            : describeSchedule(habit)}
          {" · "}
          {streakText(summary.streaks)}
          {rest && " · Rest day"}
        </p>
      </div>
      {showStrip && (
        <div className="hidden sm:block">
          <RecentStrip recent={summary.recent} title={habit.title} />
        </div>
      )}
      <button
        type="button"
        aria-pressed={rest}
        aria-label={rest ? `Undo rest day for “${habit.title}”` : `Rest day for “${habit.title}”`}
        title={rest ? "Undo rest day" : "Rest day: excused, never counted as a miss"}
        disabled={pending || future}
        onClick={() => save(rest ? { type: "clear" } : { type: "rest" })}
        className={cn(
          "rounded p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-40",
          rest && "text-foreground",
        )}
      >
        <Moon aria-hidden className={cn("size-4", rest && "fill-current")} />
      </button>
    </li>
  );
}

function AmountInput({
  title,
  value,
  target,
  unit,
  done,
  disabled,
  onSave,
}: {
  title: string;
  value: number | null;
  target: number;
  unit: string | null;
  done: boolean;
  disabled: boolean;
  onSave: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setDraft(value === null ? "" : String(value));
      return;
    }
    if (next !== value) onSave(next);
  };
  return (
    <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        aria-label={`${title}: amount${unit ? ` in ${unit}` : ""} (target ${target})`}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className={cn(
          "w-14 rounded-md border border-border bg-background px-1.5 py-0.5 text-right text-sm text-foreground tabular-nums",
          done && "border-accent",
        )}
      />
      <span className="tabular-nums">
        / {target}
        {unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

export function HabitList({
  summaries,
  date,
  today,
  label,
  showStrip,
}: {
  summaries: HabitSummary[];
  date: IsoDate;
  today: IsoDate;
  label: string;
  showStrip?: boolean;
}) {
  return (
    <ul aria-label={label}>
      {summaries.map((s) => (
        <HabitRow
          key={`${s.habit.id}-${date}`}
          summary={s}
          date={date}
          today={today}
          {...(showStrip === undefined ? {} : { showStrip })}
        />
      ))}
    </ul>
  );
}
