import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CustomizeDashboard } from "@/components/dashboard/customize-dashboard";
import { JournalPromptCard } from "@/components/dashboard/journal-prompt-card";
import { TrendBars } from "@/components/dashboard/trend-bars";
import { TaskList } from "@/components/tasks/task-row";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Section } from "@/components/ui/section";
import { dailyPrompt, summarizeOverview } from "@/features/dashboard/logic";
import { loadDashboardInsights, loadDashboardPrefs } from "@/features/dashboard/queries";
import { DASHBOARD_SECTIONS, type DashboardSection } from "@/features/dashboard/sections";
import { formatDuration } from "@/features/focus/logic";
import { loadFocusSummary } from "@/features/focus/queries";
import { loadGoalSummaries, loadMilestonesDue } from "@/features/goals/queries";
import { isDone } from "@/features/habits/logic";
import { loadHabitsForDay } from "@/features/habits/queries";
import { countInbox } from "@/features/inbox/queries";
import { plannerHref } from "@/features/planning/view";
import { loadProjectSummaries } from "@/features/projects/queries";
import { ratePercent } from "@/features/reviews/logic";
import { loadLookups } from "@/features/tasks/queries";
import { loadToday } from "@/features/tasks/today";
import { addDays, formatDate, periodStart, relativeDateLabel } from "@/lib/dates";
import { instantToLocal } from "@/lib/dates/zoned";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Dashboard" };

/** How many overdue tasks the Dashboard lists before pointing to Today. */
const ATTENTION_TASKS = 5;

/**
 * The Dashboard answers "what is happening across my life, and what deserves attention?". It is
 * the wide view: Today is where the day's work happens, so the Dashboard summarises today rather
 * than repeating its lists. Sections can be hidden (Customize).
 */
export default async function DashboardPage() {
  const ctx = await getWorkspaceContext();
  const prefs = await loadDashboardPrefs(ctx);
  const show = (key: DashboardSection) => !prefs.hidden.has(key);
  const lookups = await loadLookups(ctx);
  const weekStartDate = periodStart("week", ctx.today, ctx.weekStart);
  const none = Promise.resolve(null);

  // One parallel batch; sections that are hidden skip their queries.
  const [today, inbox, projects, goals, habits, focus, insights, milestones, weekPlan] =
    await Promise.all([
      loadToday(ctx, lookups),
      countInbox(ctx),
      loadProjectSummaries(ctx, { statuses: ["active"] }),
      loadGoalSummaries(ctx, { statuses: ["active"] }),
      show("today") ? loadHabitsForDay(ctx, ctx.today) : none,
      show("today") || show("week") ? loadFocusSummary(ctx) : none,
      show("week") ? loadDashboardInsights(ctx) : none,
      show("attention")
        ? loadMilestonesDue(ctx, { from: ctx.today, to: addDays(ctx.today, 8) })
        : none,
      show("week")
        ? ctx.supabase
            .from("plans")
            .select("theme")
            .eq("workspace_id", ctx.workspace.id)
            .eq("period", "week")
            .eq("period_start", weekStartDate)
            .maybeSingle()
        : none,
    ]);

  const summary = summarizeOverview({
    overdue: today.overdue.length,
    completedThisWeek: today.completedThisWeek,
    activeProjects: projects.length,
    activeGoals: goals.length,
    inbox,
  });
  const openMilestones = (milestones ?? []).filter((m) => !m.completed_at);

  const sections: Record<DashboardSection, () => ReactNode> = {
    attention: () => {
      const nothing = today.overdue.length === 0 && openMilestones.length === 0 && inbox === 0;
      return (
        <Section key="attention" title="Needs attention">
          {nothing ? (
            <p className="text-sm text-muted-foreground">
              Nothing overdue, no milestones due this week, and the inbox is clear.
            </p>
          ) : (
            <div className="space-y-5">
              {today.overdue.length > 0 && (
                <div>
                  <TaskList
                    tasks={today.overdue.slice(0, ATTENTION_TASKS)}
                    today={ctx.today}
                    label="Overdue"
                  />
                  {today.overdue.length > ATTENTION_TASKS && (
                    <p className="mt-1 text-sm">
                      <Link href="/today" className="text-accent hover:underline">
                        {today.overdue.length - ATTENTION_TASKS} more overdue in Today
                      </Link>
                    </p>
                  )}
                </div>
              )}
              {openMilestones.length > 0 && (
                <div>
                  <h3 className="label-caps mb-1.5">Milestones due this week</h3>
                  <ul className="space-y-1.5 text-sm">
                    {openMilestones.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-baseline gap-x-2">
                        <Link href={`/goals/${m.goal_id}`} className="hover:underline">
                          {m.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {m.goal_title} · {relativeDateLabel(m.due_date!, ctx.today)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {inbox > 0 && (
                <p className="text-sm">
                  {inbox} idea{inbox === 1 ? "" : "s"} waiting in the Inbox.{" "}
                  <Link href="/inbox" className="text-accent hover:underline">
                    Sort them
                  </Link>
                </p>
              )}
            </div>
          )}
        </Section>
      );
    },

    today: () => {
      const habitsDone = (habits ?? []).filter((h) => isDone(h.habit, h.log ?? undefined)).length;
      const next = today.scheduled.find((b) => Date.parse(b.ends_at) > Date.now());
      const stats: { label: string; value: ReactNode; href: string }[] = [
        { label: "Due today", value: today.dueToday.length, href: "/today" },
        {
          label: "Scheduled",
          value: next ? (
            <>
              {today.scheduled.length}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · next {instantToLocal(next.starts_at, ctx.timezone).time}
              </span>
            </>
          ) : (
            today.scheduled.length
          ),
          href: plannerHref("day", ctx.today),
        },
        {
          label: "Habits",
          value: habits && habits.length > 0 ? `${habitsDone}/${habits.length}` : "—",
          href: "/habits",
        },
        { label: "Focus", value: formatDuration(focus?.todaySeconds ?? 0), href: "/focus" },
      ];
      return (
        <Section
          key="today"
          title="Today at a glance"
          divider
          actions={
            <Link href="/today" className="text-accent hover:underline">
              Open Today
            </Link>
          }
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="label-caps">{s.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  <Link href={s.href} className="hover:underline">
                    {s.value}
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      );
    },

    week: () => {
      const habitRate = insights ? ratePercent(insights.habits.rate) : null;
      const theme = weekPlan?.data?.theme ?? null;
      return (
        <Section
          key="week"
          title="This week"
          divider
          actions={
            <>
              <Link href={plannerHref("week", ctx.today)} className="text-accent hover:underline">
                Weekly plan
              </Link>
              <Link href="/reviews" className="text-accent hover:underline">
                Review
              </Link>
            </>
          }
        >
          <p className="font-serif text-lg">
            {theme ? (
              theme
            ) : (
              <span className="text-muted-foreground">No theme set for this week.</span>
            )}
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Due this week, done</dt>
                <dd className="font-semibold tabular-nums">
                  {insights?.weekTaskRate == null ? "—" : `${insights.weekTaskRate}%`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Habits (scheduled days)</dt>
                <dd className="font-semibold tabular-nums">
                  {habitRate === null ? "—" : `${habitRate}%`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Completed</dt>
                <dd className="font-semibold tabular-nums">{today.completedThisWeek}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Focus</dt>
                <dd className="font-semibold tabular-nums">
                  {formatDuration(focus?.weekSeconds ?? 0)}
                </dd>
              </div>
            </dl>
            {insights && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Completed per day, last 7 days ({insights.trendTotal})
                </p>
                <TrendBars days={insights.trend} />
              </div>
            )}
          </div>
        </Section>
      );
    },

    progress: () => (
      <Section key="progress" title="Projects & goals" divider>
        {projects.length === 0 && goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active projects or goals.{" "}
            <Link href="/projects" className="text-accent hover:underline">
              Start a project
            </Link>{" "}
            or{" "}
            <Link href="/goals" className="text-accent hover:underline">
              set a goal
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="label-caps">Projects</h3>
                <Link href="/projects" className="text-xs text-accent hover:underline">
                  All projects
                </Link>
              </div>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active projects.</p>
              ) : (
                <ul className="space-y-3">
                  {projects.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <Link
                          href={`/projects/${p.id}`}
                          className="min-w-0 truncate text-sm hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.due_date && (
                          <Badge tone={p.due_date < ctx.today ? "danger" : "neutral"}>
                            {relativeDateLabel(p.due_date, ctx.today)}
                          </Badge>
                        )}
                      </div>
                      <ProgressBar progress={p.progress} label={`${p.name} progress`} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="label-caps">Goals</h3>
                <Link href="/goals" className="text-xs text-accent hover:underline">
                  All goals
                </Link>
              </div>
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active goals.</p>
              ) : (
                <ul className="space-y-3">
                  {goals.slice(0, 6).map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/goals/${g.id}`}
                        className="block truncate text-sm hover:underline"
                      >
                        {g.title}
                      </Link>
                      <ProgressBar
                        progress={
                          g.progress.milestones.total > 0 ? g.progress.milestones : g.progress.work
                        }
                        label={`${g.title} progress`}
                      />
                      {g.next && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Next: {g.next.title}
                          {g.next.due_date
                            ? ` · ${relativeDateLabel(g.next.due_date, ctx.today)}`
                            : ""}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Section>
    ),

    reflect: () => (
      <Section key="reflect" title="Reflect" divider>
        <JournalPromptCard prompt={dailyPrompt(ctx.today)} today={ctx.today} />
      </Section>
    ),
  };

  const visible = DASHBOARD_SECTIONS.filter((s) => show(s.key));

  return (
    // One width for header and sections, so Customize lines up with the content's right edge.
    <div className="max-w-4xl">
      <PageHeader
        title="Dashboard"
        description={formatDate(ctx.today)}
        meta={<p className="max-w-prose text-[0.9375rem] text-foreground">{summary}</p>}
        actions={<CustomizeDashboard hidden={[...prefs.hidden]} available={prefs.available} />}
      />
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All sections are hidden. Use Customize to show them again.
        </p>
      ) : (
        <div className="space-y-8">{visible.map((s) => sections[s.key]())}</div>
      )}
    </div>
  );
}
