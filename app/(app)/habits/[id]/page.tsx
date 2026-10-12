import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HabitArchiveDelete, HabitTitle } from "@/components/habits/habit-actions";
import { HabitHistory, type HistoryCell } from "@/components/habits/habit-history";
import { HabitList } from "@/components/habits/habit-row";
import { HabitSettings } from "@/components/habits/habit-settings";
import {
  dayStatus,
  describeSchedule,
  streakText,
  type CompletionRate,
} from "@/features/habits/logic";
import { loadHabitDetail } from "@/features/habits/queries";
import { loadLookups } from "@/features/tasks/queries";
import { addDays, dayOfWeek, periodStart } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Habit" };

const WEEKS = 12;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Rate({ label, rate }: { label: string; rate: CompletionRate }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xl font-semibold tabular-nums">
        {rate.rate === null ? "—" : `${Math.round(rate.rate * 100)}%`}
      </p>
      <p className="text-xs text-muted-foreground">
        {label}
        {rate.due > 0 && ` · ${rate.done} of ${rate.due}`}
      </p>
    </div>
  );
}

export default async function HabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getWorkspaceContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, lookups] = await Promise.all([loadHabitDetail(ctx, id), loadLookups(ctx)]);
  if (!detail) notFound();
  const { habit } = detail;

  const firstWeek = periodStart("week", addDays(ctx.today, -(WEEKS - 1) * 7), ctx.weekStart);
  const byDate = new Map(detail.logs.map((l) => [l.log_date, l]));
  const weeks: HistoryCell[][] = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(firstWeek, w * 7 + d);
      return {
        date,
        status: dayStatus(habit, date, byDate.get(date), ctx.today),
        log: byDate.get(date) ?? null,
      };
    }),
  );
  const weekdayLabels = Array.from(
    { length: 7 },
    (_, d) => DAY_NAMES[dayOfWeek(addDays(firstWeek, d))]!,
  );
  const area = lookups.areas.find((a) => a.id === habit.area_id);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-sm">
          <Link href="/habits" className="text-muted-foreground hover:underline">
            ← Habits
          </Link>
        </p>
        <HabitTitle habitId={habit.id} title={habit.title} />
        <p className="mt-1 px-2 text-sm text-muted-foreground">
          {describeSchedule(habit)}
          {habit.kind === "measurable" &&
            ` · target ${habit.target_value}${habit.unit ? ` ${habit.unit}` : ""}`}
          {area && ` · ${area.name}`}
          {habit.archived_at && " · Archived"}
        </p>
      </div>

      {!habit.archived_at && (
        <section aria-labelledby="habit-today">
          <h2 id="habit-today" className="mb-1 text-sm font-semibold">
            Today
          </h2>
          <HabitList
            summaries={[detail]}
            date={ctx.today}
            today={ctx.today}
            label="Today"
            showStrip={false}
          />
        </section>
      )}

      <section aria-labelledby="habit-stats">
        <h2 id="habit-stats" className="mb-2 text-sm font-semibold">
          Progress
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xl font-semibold tabular-nums">{detail.streaks.current}</p>
            <p className="text-xs text-muted-foreground">Current streak ({detail.streaks.unit}s)</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xl font-semibold tabular-nums">{detail.streaks.longest}</p>
            <p className="text-xs text-muted-foreground">Longest streak ({detail.streaks.unit}s)</p>
          </div>
          <Rate label="This week" rate={detail.rates.week} />
          <Rate label="This month" rate={detail.rates.month} />
          <Rate label="Last 30 days" rate={detail.rates.last30} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {streakText(detail.streaks)}. Rates count only days the habit was due; rest days and today
          (until done) are left out.
        </p>
      </section>

      <section aria-labelledby="habit-history">
        <h2 id="habit-history" className="mb-2 text-sm font-semibold">
          Last {WEEKS} weeks
        </h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Select a day to correct it. Streaks recalculate from the edited history.
        </p>
        <HabitHistory
          habitId={habit.id}
          title={habit.title}
          kind={habit.kind}
          target={habit.target_value}
          unit={habit.unit}
          weeks={weeks}
          weekdayLabels={weekdayLabels}
          today={ctx.today}
        />
      </section>

      <section
        aria-labelledby="habit-settings"
        className="rounded-lg border border-border bg-surface p-5"
      >
        <h2 id="habit-settings" className="mb-3 text-sm font-semibold">
          Settings
        </h2>
        <HabitSettings habit={habit} areas={lookups.areas} />
      </section>

      <HabitArchiveDelete
        habitId={habit.id}
        title={habit.title}
        archived={habit.archived_at !== null}
      />
    </div>
  );
}
