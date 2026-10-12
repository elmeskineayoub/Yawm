import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { HabitList } from "@/components/habits/habit-row";
import { ScheduledList } from "@/components/planner/scheduled-list";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { isDone } from "@/features/habits/logic";
import { loadHabitsForDay } from "@/features/habits/queries";
import { loadLookups } from "@/features/tasks/queries";
import { planItemLink } from "@/features/planning/queries";
import { plannerHref } from "@/features/planning/view";
import { loadToday } from "@/features/tasks/today";
import { formatDate } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const ctx = await getWorkspaceContext();
  const lookups = await loadLookups(ctx);
  const [data, habits] = await Promise.all([
    loadToday(ctx, lookups),
    loadHabitsForDay(ctx, ctx.today),
  ]);
  const nothingDue = data.overdue.length === 0 && data.dueToday.length === 0;

  return (
    <>
      <PageHeader title="Today" description={`${formatDate(ctx.today)} · ${ctx.timezone}`} />
      <div className="space-y-8">
        <QuickAddTask defaultDueDate={ctx.today} placeholder="Add a task for today" compact />

        <section aria-labelledby="priorities-heading">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 id="priorities-heading" className="text-sm font-semibold">
              Today&apos;s priorities
            </h2>
            <Link
              href={plannerHref("day", ctx.today)}
              className="text-sm text-accent hover:underline"
            >
              {data.dayPlanId ? "Edit day plan" : "Plan the day"}
            </Link>
          </div>
          {data.priorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No priorities chosen. Link tasks or projects to today&apos;s plan.
            </p>
          ) : (
            <ul aria-label="Today's priorities">
              {data.priorities.map((item) =>
                item.kind === "task" ? (
                  <TaskRow key={item.id} task={item.task} today={ctx.today} />
                ) : item.kind === "project" ? (
                  <li key={item.id} className="border-b border-border py-2.5 last:border-b-0">
                    <Link
                      href={`/projects/${item.project.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {item.project.name}
                    </Link>
                    <div className="mt-1 max-w-xs">
                      <ProgressBar
                        progress={item.project.progress}
                        label={`${item.project.name} progress`}
                      />
                    </div>
                  </li>
                ) : (
                  <li key={item.id} className="border-b border-border py-2.5 last:border-b-0">
                    <Link
                      href={planItemLink(item).href}
                      className="text-sm font-medium hover:underline"
                    >
                      {planItemLink(item).title}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">
                      ({planItemLink(item).label})
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </section>

        {habits.length > 0 && (
          <section aria-labelledby="habits-heading">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 id="habits-heading" className="text-sm font-semibold">
                Habits{" "}
                <span className="font-normal text-muted-foreground">
                  {habits.filter((h) => isDone(h.habit, h.log ?? undefined)).length}/{habits.length}
                </span>
              </h2>
              <Link href="/habits" className="text-sm text-accent hover:underline">
                All habits
              </Link>
            </div>
            <HabitList
              summaries={habits}
              date={ctx.today}
              today={ctx.today}
              label="Today's habits"
            />
          </section>
        )}

        <section aria-labelledby="scheduled-heading">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 id="scheduled-heading" className="text-sm font-semibold">
              Scheduled
            </h2>
            <Link
              href={plannerHref("day", ctx.today)}
              className="text-sm text-accent hover:underline"
            >
              Open timeline
            </Link>
          </div>
          <ScheduledList
            blocks={data.scheduled}
            timezone={ctx.timezone}
            dayHref={plannerHref("day", ctx.today)}
          />
        </section>

        {data.overdue.length > 0 && (
          <section aria-labelledby="overdue-heading">
            <h2
              id="overdue-heading"
              className="mb-1 text-sm font-semibold text-red-700 dark:text-red-400"
            >
              Overdue <span className="font-normal">{data.overdue.length}</span>
            </h2>
            <TaskList tasks={data.overdue} today={ctx.today} label="Overdue" />
          </section>
        )}

        <section aria-labelledby="due-today-heading">
          <h2 id="due-today-heading" className="mb-1 text-sm font-semibold">
            Due today{" "}
            <span className="font-normal text-muted-foreground">{data.dueToday.length}</span>
          </h2>
          {data.dueToday.length === 0 ? (
            <EmptyState title={nothingDue ? "Nothing due today" : "Nothing else due today"}>
              {data.upcoming.length > 0
                ? `Next up: ${data.upcoming[0]!.title}`
                : "Enjoy the space, or pull something forward."}
            </EmptyState>
          ) : (
            <TaskList tasks={data.dueToday} today={ctx.today} label="Due today" />
          )}
        </section>

        {data.completedToday.length > 0 && (
          <section aria-labelledby="done-today-heading">
            <h2 id="done-today-heading" className="mb-1 text-sm font-semibold">
              Completed today{" "}
              <span className="font-normal text-muted-foreground">
                {data.completedToday.length}
              </span>
            </h2>
            <TaskList tasks={data.completedToday} today={ctx.today} label="Completed today" />
          </section>
        )}
      </div>
    </>
  );
}
