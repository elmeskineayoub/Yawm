import type { Metadata } from "next";
import Link from "next/link";
import { HabitList } from "@/components/habits/habit-row";
import { NewHabit } from "@/components/habits/new-habit";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { describeSchedule, isDone } from "@/features/habits/logic";
import { loadHabitSummaries } from "@/features/habits/queries";
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
  const summaries = await loadHabitSummaries(ctx, { archived: showArchived });

  if (showArchived) {
    return (
      <>
        <PageHeader title="Archived habits" description="History is kept. Restore one any time." />
        <p className="mb-4 text-sm">
          <Link href="/habits" className="text-accent hover:underline">
            ← Back to habits
          </Link>
        </p>
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

  const dueToday = summaries.filter((s) => s.due);
  const others = summaries.filter((s) => !s.due);

  return (
    <>
      <PageHeader title="Habits" description={`${formatDate(ctx.today)} · ${ctx.timezone}`} />
      <div className="space-y-8">
        <NewHabit />
        {summaries.length === 0 ? (
          <EmptyState title="No habits yet">
            Add one above: anything you want to do regularly, such as reading, exercise, or a prayer
            you keep. Rest days never count against a streak.
          </EmptyState>
        ) : (
          <>
            <section aria-labelledby="habits-today">
              <h2 id="habits-today" className="mb-1 text-sm font-semibold">
                Today{" "}
                <span className="font-normal text-muted-foreground">
                  {dueToday.filter((s) => isDone(s.habit, s.log ?? undefined)).length}/
                  {dueToday.length}
                </span>
              </h2>
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
            </section>
            {others.length > 0 && (
              <section aria-labelledby="habits-other">
                <h2 id="habits-other" className="mb-1 text-sm font-semibold">
                  Not due today
                </h2>
                <p className="mb-1 text-xs text-muted-foreground">
                  A scheduled rest day, outside the habit&apos;s dates, or this week&apos;s target
                  is already met. You can still record them.
                </p>
                <HabitList
                  summaries={others}
                  date={ctx.today}
                  today={ctx.today}
                  label="Habits not due today"
                />
              </section>
            )}
          </>
        )}
        <p className="text-sm">
          <Link href="/habits?archived=1" className="text-muted-foreground hover:underline">
            Archived habits
          </Link>
        </p>
      </div>
    </>
  );
}
