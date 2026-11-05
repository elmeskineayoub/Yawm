import type { Metadata } from "next";
import Link from "next/link";
import { HabitList } from "@/components/habits/habit-row";
import { NewHabit } from "@/components/habits/new-habit";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { describeSchedule, isDone } from "@/features/habits/logic";
import { loadHabitSummaries } from "@/features/habits/queries";
import { loadLookups } from "@/features/tasks/queries";
import { formatDate } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getWorkspaceContext();
  const showArchived = (await searchParams).archived === "1";

  if (showArchived) {
    const summaries = await loadHabitSummaries(ctx, { archived: true });
    return (
      <>
        <PageHeader
          title="Archived habits"
          description="History is kept. Open one to restore it."
          breadcrumb={[{ label: "Habits", href: "/habits" }]}
        />
        {summaries.length === 0 ? (
          <EmptyState title="No archived habits" />
        ) : (
          <ul aria-label="Archived habits" className="divide-y divide-border">
            {summaries.map(({ habit }) => (
              <li key={habit.id} className="py-2.5">
                <Link href={`/habits/${habit.id}`} className="text-sm hover:underline">
                  {habit.title}
                </Link>
                <p className="text-xs text-muted-foreground">{describeSchedule(habit)}</p>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const [summaries, lookups] = await Promise.all([
    loadHabitSummaries(ctx, { archived: false }),
    loadLookups(ctx),
  ]);
  const dueToday = summaries.filter((s) => s.due);
  const others = summaries.filter((s) => !s.due);
  const doneCount = dueToday.filter((s) => isDone(s.habit, s.log ?? undefined)).length;
  const percent = dueToday.length ? Math.round((doneCount / dueToday.length) * 100) : 0;

  const summary =
    summaries.length === 0
      ? "Build routines one day at a time."
      : dueToday.length === 0
        ? "Nothing is due today. Enjoy the rest."
        : doneCount === dueToday.length
          ? `All ${dueToday.length} done today.`
          : `${doneCount} of ${dueToday.length} done today.`;

  return (
    <>
      <PageHeader
        title="Habits"
        description={summary}
        meta={`${formatDate(ctx.today)} · ${ctx.timezone}`}
        actions={
          <>
            <Link
              href="/habits?archived=1"
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              Archived habits
            </Link>
            <NewHabit areas={lookups.areas} today={ctx.today} />
          </>
        }
      />
      {summaries.length === 0 ? (
        <EmptyState title="No habits yet">
          <span className="block">
            Anything you want to do regularly, such as reading, exercise, or a prayer you keep. Pick
            the days, or a number of times a week. Rest days never count against a streak.
          </span>
          <span className="mt-4 inline-block">
            <NewHabit areas={lookups.areas} today={ctx.today} variant="outline" />
          </span>
        </EmptyState>
      ) : (
        <div className="max-w-3xl space-y-10">
          <Section
            title="Today"
            count={`${doneCount}/${dueToday.length}`}
            description={
              dueToday.length > 0
                ? "Tick it off, enter an amount, or mark a rest day (the moon)."
                : undefined
            }
          >
            {dueToday.length > 0 && (
              <div
                role="progressbar"
                aria-label="Habits done today"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={`${doneCount} of ${dueToday.length} done`}
                className="mb-2 h-1 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
            {dueToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due today. Enjoy the rest.</p>
            ) : (
              <HabitList
                summaries={dueToday}
                date={ctx.today}
                today={ctx.today}
                label="Habits due today"
              />
            )}
          </Section>
          {others.length > 0 && (
            <details className="group border-t border-border pt-6">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="text-muted-foreground transition-transform group-open:rotate-90"
                >
                  ›
                </span>
                Not due today
                <span className="font-normal text-muted-foreground tabular-nums">
                  {others.length}
                </span>
              </summary>
              <p className="mt-2 mb-1 text-xs text-muted-foreground">
                A scheduled rest day, outside the habit&apos;s dates, or this week&apos;s target is
                already met. You can still record them.
              </p>
              <HabitList
                summaries={others}
                date={ctx.today}
                today={ctx.today}
                label="Habits not due today"
              />
            </details>
          )}
        </div>
      )}
    </>
  );
}
