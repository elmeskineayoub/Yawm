import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { JournalPromptCard } from "@/components/dashboard/journal-prompt-card";
import { TrendBars } from "@/components/dashboard/trend-bars";
import { HabitList } from "@/components/habits/habit-row";
import { ScheduledList } from "@/components/planner/scheduled-list";
import { TaskList } from "@/components/tasks/task-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { dailyPrompt } from "@/features/dashboard/logic";
import { loadDashboardInsights } from "@/features/dashboard/queries";
import { formatDuration } from "@/features/focus/logic";
import { loadFocusSummary } from "@/features/focus/queries";
import { ratePercent } from "@/features/reviews/logic";
import { isDone } from "@/features/habits/logic";
import { loadHabitsForDay } from "@/features/habits/queries";
import { countInbox } from "@/features/inbox/queries";
import { loadProjectSummaries } from "@/features/projects/queries";
import { loadLookups } from "@/features/tasks/queries";
import { planItemLink } from "@/features/planning/queries";
import { plannerHref } from "@/features/planning/view";
import { loadToday } from "@/features/tasks/today";
import { formatDate, formatPeriod, periodStart } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Dashboard" };

function Tile({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted"
    >
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "danger" && value > 0 && "text-red-700 dark:text-red-400",
        )}
      >
        {value}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Link>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = `card-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const ctx = await getWorkspaceContext();
  const lookups = await loadLookups(ctx);
  const weekStartDate = periodStart("week", ctx.today, ctx.weekStart);
  // One parallel batch (incl. the week plan) rather than a trailing serial query — one fewer
  // round-trip, which matters most when the database is a round-trip away.
  const [today, inboxCount, projects, habits, focus, insights, weekPlanResult] = await Promise.all([
    loadToday(ctx, lookups),
    countInbox(ctx),
    loadProjectSummaries(ctx, { statuses: ["active"] }),
    loadHabitsForDay(ctx, ctx.today),
    loadFocusSummary(ctx),
    loadDashboardInsights(ctx),
    ctx.supabase
      .from("plans")
      .select("theme")
      .eq("workspace_id", ctx.workspace.id)
      .eq("period", "week")
      .eq("period_start", weekStartDate)
      .maybeSingle(),
  ]);
  const weekPlan = weekPlanResult.data;
  const habitWeekPercent = ratePercent(insights.habits.rate);
  const habitsDone = habits.filter((h) => isDone(h.habit, h.log ?? undefined)).length;

  const attention = [...today.overdue, ...today.dueToday];

  return (
    <>
      <PageHeader title="Dashboard" description={formatDate(ctx.today)} />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            href="/tasks?due=overdue"
            label="Overdue"
            value={today.overdue.length}
            tone="danger"
          />
          <Tile href="/today" label="Due today" value={today.dueToday.length} />
          <Tile href="/inbox" label="Ideas in inbox" value={inboxCount} />
          <Tile href="/projects" label="Active projects" value={projects.length} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            title="Completed last 7 days"
            action={
              <Link href="/reviews" className="text-sm text-accent hover:underline">
                Weekly review
              </Link>
            }
          >
            <TrendBars days={insights.trend} />
            <p className="mt-3 text-sm text-muted-foreground">
              {insights.trendTotal} task{insights.trendTotal === 1 ? "" : "s"} completed in the last
              7 days.
            </p>
          </Card>

          <Card title="This week's progress">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Tasks due this week done</dt>
                <dd className="tabular-nums">
                  {insights.weekTaskRate === null ? "—" : `${insights.weekTaskRate}%`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Habits (scheduled days)</dt>
                <dd className="tabular-nums">
                  {habitWeekPercent === null ? "—" : `${habitWeekPercent}%`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Focus time</dt>
                <dd className="tabular-nums">{formatDuration(focus.weekSeconds)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Completed this week</dt>
                <dd className="tabular-nums">{today.completedThisWeek}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Reflect">
            <JournalPromptCard prompt={dailyPrompt(ctx.today)} today={ctx.today} />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="Today's priorities"
            action={
              <Link
                href={plannerHref("day", ctx.today)}
                className="text-sm text-accent hover:underline"
              >
                Plan the day
              </Link>
            }
          >
            {today.priorities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No priorities chosen for today.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {today.priorities.map((item) => (
                  <li key={item.id}>
                    {item.kind === "task" ? (
                      <Link
                        href={`/tasks/${item.task.id}`}
                        className={cn(
                          "hover:underline",
                          item.task.status === "done" && "text-muted-foreground line-through",
                        )}
                      >
                        {item.task.title}
                      </Link>
                    ) : (
                      <Link href={planItemLink(item).href} className="hover:underline">
                        {planItemLink(item).title} ({planItemLink(item).label})
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Scheduled today"
            action={
              <Link
                href={plannerHref("day", ctx.today)}
                className="text-sm text-accent hover:underline"
              >
                Timeline
              </Link>
            }
          >
            <ScheduledList
              blocks={today.scheduled}
              timezone={ctx.timezone}
              dayHref={plannerHref("day", ctx.today)}
            />
          </Card>

          <Card
            title="Today's habits"
            action={
              <Link href="/habits" className="text-sm text-accent hover:underline">
                {habits.length ? `${habitsDone} of ${habits.length} done` : "Habits"}
              </Link>
            }
          >
            {habits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No habits due today.</p>
            ) : (
              <HabitList
                summaries={habits}
                date={ctx.today}
                today={ctx.today}
                label="Today's habits"
                showStrip={false}
              />
            )}
          </Card>

          <Card
            title="This week"
            action={
              <Link
                href={plannerHref("week", ctx.today)}
                className="text-sm text-accent hover:underline"
              >
                Weekly plan
              </Link>
            }
          >
            <p className="text-sm">
              {weekPlan?.theme ? (
                <>
                  Theme: <span className="font-medium">{weekPlan.theme}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No weekly theme set.</span>
              )}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {today.completedThisWeek} task{today.completedThisWeek === 1 ? "" : "s"} completed
              since {formatPeriod("week", today.weekStartDate).replace("Week of ", "")}.
            </p>
          </Card>

          <Card
            title="Needs attention"
            action={
              <Link href="/today" className="text-sm text-accent hover:underline">
                Open Today
              </Link>
            }
          >
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing overdue or due today.</p>
            ) : (
              <TaskList tasks={attention.slice(0, 8)} today={ctx.today} label="Needs attention" />
            )}
          </Card>

          <Card
            title="Focus"
            action={
              <Link href="/focus" className="text-sm text-accent hover:underline">
                Start focus
              </Link>
            }
          >
            <p className="text-sm">
              <span className="font-medium tabular-nums">{formatDuration(focus.todaySeconds)}</span>{" "}
              focused today
              {focus.todayCount > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {focus.todayCount} session{focus.todayCount === 1 ? "" : "s"}
                </span>
              )}
            </p>
            {focus.recent[0] && (
              <p className="mt-1 text-xs text-muted-foreground">
                Last: {formatDuration(focus.recent[0].duration_seconds)}
                {focus.recent[0].task ? ` · ${focus.recent[0].task.title}` : ""}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDuration(focus.weekSeconds)} this week.
            </p>
          </Card>

          <Card title="Upcoming (next 7 days)">
            {today.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deadlines in the next week.</p>
            ) : (
              <TaskList tasks={today.upcoming.slice(0, 8)} today={ctx.today} label="Upcoming" />
            )}
          </Card>

          <Card
            title="Active projects"
            action={
              <Link href="/projects" className="text-sm text-accent hover:underline">
                All projects
              </Link>
            }
          >
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            ) : (
              <ul className="space-y-3">
                {projects.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="text-sm hover:underline">
                      {p.name}
                    </Link>
                    <ProgressBar progress={p.progress} label={`${p.name} progress`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
