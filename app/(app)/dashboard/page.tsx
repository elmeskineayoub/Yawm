import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduledList } from "@/components/planner/scheduled-list";
import { TaskList } from "@/components/tasks/task-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { countInbox } from "@/features/inbox/queries";
import { loadProjectSummaries } from "@/features/projects/queries";
import { loadLookups } from "@/features/tasks/queries";
import { plannerHref } from "@/features/planning/view";
import { loadToday } from "@/features/tasks/today";
import { formatDate, formatPeriod } from "@/lib/dates";
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
  const [today, inboxCount, projects] = await Promise.all([
    loadToday(ctx, lookups),
    countInbox(ctx),
    loadProjectSummaries(ctx, { statuses: ["active"] }),
  ]);
  const { data: weekPlan } = await ctx.supabase
    .from("plans")
    .select("theme")
    .eq("workspace_id", ctx.workspace.id)
    .eq("period", "week")
    .eq("period_start", today.weekStartDate)
    .maybeSingle();

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
                      <Link href={`/projects/${item.project.id}`} className="hover:underline">
                        {item.project.name} (project)
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
