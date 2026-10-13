import type { Metadata } from "next";
import Link from "next/link";
import { ReviewEditor } from "@/components/reviews/review-editor";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDuration } from "@/features/focus/logic";
import { ratePercent } from "@/features/reviews/logic";
import { loadWeeklyReview } from "@/features/reviews/queries";
import { formatDate, formatPeriodTitle, isIsoDate, periodStart, shiftPeriod } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Reviews" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
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

  const review = await loadWeeklyReview(ctx, weekStart);
  const habitPercent = ratePercent(review.habits.rate);

  const href = (start: string) => (start === thisWeek ? "/reviews" : `/reviews?week=${start}`);
  const prev = shiftPeriod("week", weekStart, -1);
  const next = shiftPeriod("week", weekStart, 1);

  return (
    <>
      <PageHeader
        title="Weekly review"
        description="Look back at the week, then set up the next one. Figures cover the week shown."
      />

      <nav
        aria-label="Week"
        className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <div className="flex items-center gap-2">
          <Link
            href={href(prev)}
            rel="prev"
            className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-muted"
          >
            ← Previous
          </Link>
          <Link
            href={href(next)}
            rel="next"
            className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-muted"
          >
            Next →
          </Link>
          {weekStart !== thisWeek && (
            <Link href="/reviews" className="px-2 text-accent hover:underline">
              This week
            </Link>
          )}
        </div>
        <p className="font-medium">{formatPeriodTitle("week", weekStart)}</p>
      </nav>

      <div className="space-y-6">
        <section aria-label="Week statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section
            aria-labelledby="completed-heading"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 id="completed-heading" className="mb-2 text-sm font-semibold">
              Completed this week
            </h2>
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
          </section>

          <section
            aria-labelledby="habits-heading"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 id="habits-heading" className="mb-2 text-sm font-semibold">
              Habit completion (scheduled days)
            </h2>
            {review.habits.perHabit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No habits yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {review.habits.perHabit.map((h) => {
                  const pct = ratePercent(h.rate);
                  return (
                    <li key={h.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{h.title}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {pct === null ? "—" : `${pct}% (${h.done}/${h.due})`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="projects-heading"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 id="projects-heading" className="mb-2 text-sm font-semibold">
              Active project progress
            </h2>
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
          </section>

          <section
            aria-labelledby="goals-heading"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 id="goals-heading" className="mb-2 text-sm font-semibold">
              Active goal progress
            </h2>
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
          </section>
        </div>

        <section
          aria-labelledby="reflection-heading"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <h2 id="reflection-heading" className="mb-1 text-sm font-semibold">
            Reflection
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Week of {formatDate(weekStart)}. Each answer saves on its own.
          </p>
          <ReviewEditor weekStart={weekStart} text={review.text} />
        </section>
      </div>
    </>
  );
}
