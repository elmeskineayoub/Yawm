import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HabitArchiveDelete, HabitTitle } from "@/components/habits/habit-actions";
import { HabitHistory, type HistoryCell } from "@/components/habits/habit-history";
import { HabitList } from "@/components/habits/habit-row";
import { HabitSettings } from "@/components/habits/habit-form";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/ui/section";
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

function Stat({ value, label, detail }: { value: string; label: string; detail?: string }) {
  return (
    <div>
      <p className="font-serif text-2xl tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">
        {label}
        {detail && ` · ${detail}`}
      </p>
    </div>
  );
}

const ratePercent = (rate: CompletionRate) =>
  rate.rate === null ? "—" : `${Math.round(rate.rate * 100)}%`;
const rateDetail = (rate: CompletionRate) =>
  rate.due > 0 ? `${rate.done} of ${rate.due}` : undefined;

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

  const unit = detail.streaks.unit;
  return (
    <>
      <PageHeader
        title={habit.title}
        breadcrumb={[
          { label: "Habits", href: habit.archived_at ? "/habits?archived=1" : "/habits" },
        ]}
        meta={
          <>
            {describeSchedule(habit)}
            {habit.kind === "measurable" &&
              ` · target ${habit.target_value}${habit.unit ? ` ${habit.unit}` : ""}`}
            {area && ` · ${area.name}`}
            {habit.archived_at && " · Archived"}
          </>
        }
      />
      <div className="max-w-3xl space-y-10">
        {!habit.archived_at && (
          <Section title="Today">
            <HabitList
              summaries={[detail]}
              date={ctx.today}
              today={ctx.today}
              label="Today"
              showStrip={false}
            />
          </Section>
        )}

        <Section
          title="Progress"
          description={`${streakText(detail.streaks)}. Rates count only days the habit was due; rest days and today (until done) are left out.`}
        >
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
            <Stat value={String(detail.streaks.current)} label={`Current streak (${unit}s)`} />
            <Stat value={String(detail.streaks.longest)} label={`Longest streak (${unit}s)`} />
            <Stat
              value={ratePercent(detail.rates.week)}
              label="This week"
              {...(rateDetail(detail.rates.week) ? { detail: rateDetail(detail.rates.week)! } : {})}
            />
            <Stat
              value={ratePercent(detail.rates.month)}
              label="This month"
              {...(rateDetail(detail.rates.month)
                ? { detail: rateDetail(detail.rates.month)! }
                : {})}
            />
            <Stat
              value={ratePercent(detail.rates.last30)}
              label="Last 30 days"
              {...(rateDetail(detail.rates.last30)
                ? { detail: rateDetail(detail.rates.last30)! }
                : {})}
            />
          </div>
        </Section>

        <Section
          title={`Last ${WEEKS} weeks`}
          divider
          description="Select a day to correct it. Streaks recalculate from the edited history."
        >
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
        </Section>

        <Section title="Settings" divider>
          <div className="space-y-5">
            <HabitTitle habitId={habit.id} title={habit.title} />
            <HabitSettings habit={habit} areas={lookups.areas} />
          </div>
        </Section>

        <div className="border-t border-border pt-6">
          <HabitArchiveDelete
            habitId={habit.id}
            title={habit.title}
            archived={habit.archived_at !== null}
          />
        </div>
      </div>
    </>
  );
}
