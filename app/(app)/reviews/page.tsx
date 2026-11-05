import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CarryForward } from "@/components/reviews/carry-forward";
import { ReviewEditor } from "@/components/reviews/review-editor";
import { buttonClass } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Section } from "@/components/ui/section";
import { formatDuration } from "@/features/focus/logic";
import { plannerHref } from "@/features/planning/view";
import { ratePercent } from "@/features/reviews/logic";
import { loadWeekPlanSummary, loadWeeklyReview } from "@/features/reviews/queries";
import {
  formatDate,
  formatPeriodTitle,
  isIsoDate,
  periodStart,
  shiftPeriod,
  type IsoDate,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Reviews" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="font-serif text-3xl tabular-nums">{value}</p>
      <p className="text-sm">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A numbered step heading: the review reads top to bottom as look back, reflect, decide. */
function Step({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`step-${n}`} className="border-t border-border pt-8">
      <div className="mb-6 flex items-baseline gap-3">
        <span aria-hidden className="font-serif text-2xl text-muted-foreground tabular-nums">
          {n}
        </span>
        <div>
          <h2 id={`step-${n}`} className="font-serif text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getWorkspaceContext();
  const params = await searchParams;
  const raw = Array.isArray(params.week) ? params.week[0] : params.week;
  const anchor = raw && isIsoDate(raw) ? raw : ctx.today;
  // Snap any date to the start of its week so the URL is always a week boundary.
  const weekStart = periodStart("week", anchor, ctx.weekStart);
  const thisWeek = periodStart("week", ctx.today, ctx.weekStart);
  const prev = shiftPeriod("week", weekStart, -1);
  const next = shiftPeriod("week", weekStart, 1);
  const future = weekStart > thisWeek;
  // Carried work moves to the start of the next week, never to a day that has already passed.
  const target: IsoDate = next > ctx.today ? next : ctx.today;

  const [review, nextPlan] = await Promise.all([
    loadWeeklyReview(ctx, weekStart),
    future ? Promise.resolve(null) : loadWeekPlanSummary(ctx, next),
  ]);
  const habitPercent = ratePercent(review.habits.rate);
  const href = (start: string) => (start === thisWeek ? "/reviews" : `/reviews?week=${start}`);
  const navLink =
    "rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground";

  return (
    <>
      <PageHeader
        title="Weekly review"
        description="Look back at the week, reflect on it, then decide what happens next."
        meta={
          <nav aria-label="Week" className="flex flex-wrap items-center gap-2">
            <Link href={href(prev)} rel="prev" aria-label="Previous week" className={navLink}>
              <ChevronLeft aria-hidden className="size-4" />
            </Link>
            <span className="font-medium text-foreground">
              {formatPeriodTitle("week", weekStart)}
            </span>
            <Link href={href(next)} rel="next" aria-label="Next week" className={navLink}>
              <ChevronRight aria-hidden className="size-4" />
            </Link>
            {weekStart !== thisWeek && (
              <Link href="/reviews" className="text-accent hover:underline">
                This week
              </Link>
            )}
          </nav>
        }
      />

      <div className="max-w-5xl space-y-12">
        <Step n={1} title="Look back" description="What actually happened, from your records.">
          <div
            aria-label="Week statistics"
            role="group"
            className="mb-8 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4"
          >
            <Stat label="Tasks completed" value={String(review.completedCount)} />
            <Stat
              label="Carried forward"
              value={String(review.carriedForward)}
              hint="Open tasks due this week"
            />
            <Stat
              label="Habits"
              value={habitPercent === null ? "—" : `${habitPercent}%`}
              hint={
                review.habits.due === 0
                  ? "Nothing scheduled"
                  : `${review.habits.done}/${review.habits.due} scheduled done`
              }
            />
            <Stat label="Focus time" value={formatDuration(review.focusSeconds)} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-8 lg:grid-cols-2">
            <Section title="Completed this week" count={review.completedTasks.length || undefined}>
              {review.completedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks completed this week.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {review.completedTasks.slice(0, 12).map((t) => (
                    <li key={t.id}>
                      <Link href={`/tasks/${t.id}`} className="hover:underline">
                        {t.title}
                      </Link>
                    </li>
                  ))}
                  {review.completedTasks.length > 12 && (
                    <li className="text-xs text-muted-foreground">
                      +{review.completedTasks.length - 12} more
                    </li>
                  )}
                </ul>
              )}
            </Section>

            <Section title="Habits on scheduled days">
              {review.habits.perHabit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No habits yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {review.habits.perHabit.map((h) => {
                    const pct = ratePercent(h.rate);
                    return (
                      <li key={h.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">{h.title}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {pct === null ? "—" : `${pct}% (${h.done}/${h.due})`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="Active projects">
              {review.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active projects.</p>
              ) : (
                <ul className="space-y-3">
                  {review.projects.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="text-sm hover:underline">
                        {p.name}
                      </Link>
                      <ProgressBar progress={p.progress} label={`${p.name} progress`} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Active goals">
              {review.goals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active goals.</p>
              ) : (
                <ul className="space-y-3">
                  {review.goals.slice(0, 6).map((g) => (
                    <li key={g.id}>
                      <Link href={`/goals/${g.id}`} className="text-sm hover:underline">
                        {g.title}
                      </Link>
                      <ProgressBar progress={g.progress.work} label={`${g.title} work progress`} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </Step>

        <Step
          n={2}
          title="Reflect"
          description={`Week of ${formatDate(weekStart)}. Each answer saves on its own.`}
        >
          <div className="max-w-3xl">
            <ReviewEditor weekStart={weekStart} text={review.text} />
          </div>
        </Step>

        {nextPlan && (
          <Step
            n={3}
            title="Decide"
            description="Close the loop: deal with what's unfinished, then set up next week."
          >
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <Section title="Unfinished from this week" count={review.carriedForward || undefined}>
                <CarryForward
                  tasks={review.carriedTasks}
                  total={review.carriedForward}
                  target={target}
                />
              </Section>
              <Section
                title={`Next week · ${formatDate(next, "short")}`}
                actions={
                  <Link
                    href={plannerHref("week", next)}
                    className={cn(buttonClass({ variant: "outline", size: "sm" }))}
                  >
                    Plan next week
                  </Link>
                }
              >
                {nextPlan.theme && <p className="mb-2 font-serif text-lg">{nextPlan.theme}</p>}
                {nextPlan.priorities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No priorities yet. Pick up to five in the Planner; your answer to &ldquo;Next
                    week&apos;s priorities&rdquo; above is a good place to start.
                  </p>
                ) : (
                  <ol aria-label="Next week's priorities" className="space-y-1.5 text-sm">
                    {nextPlan.priorities.map((p, i) => (
                      <li key={`${p.kind}-${p.id}`} className="flex gap-2">
                        <span className="w-4 shrink-0 text-muted-foreground tabular-nums">
                          {i + 1}
                        </span>
                        <Link
                          href={p.href}
                          className={cn(
                            "min-w-0 hover:underline",
                            p.done && "text-muted-foreground line-through",
                          )}
                        >
                          {p.title}
                        </Link>
                        <span className="shrink-0 text-xs text-muted-foreground">{p.kind}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </div>
          </Step>
        )}
      </div>
    </>
  );
}
