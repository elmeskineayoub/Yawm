import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { JournalPromptCard } from "@/components/dashboard/journal-prompt-card";
import { FocusTimer } from "@/components/focus/focus-timer";
import { HabitList } from "@/components/habits/habit-row";
import { InlineText } from "@/components/planner/inline-text";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { DayAgenda } from "@/components/today/day-agenda";
import { RescheduleOverdue } from "@/components/today/reschedule-overdue";
import { TodayLayout } from "@/components/today/today-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Section } from "@/components/ui/section";
import { dailyPrompt } from "@/features/dashboard/logic";
import { isDone } from "@/features/habits/logic";
import { loadHabitsForDay } from "@/features/habits/queries";
import { planItemLink } from "@/features/planning/queries";
import { plannerHref } from "@/features/planning/view";
import { loadLookups } from "@/features/tasks/queries";
import { loadToday } from "@/features/tasks/today";
import { buildDayAgenda, summarizeToday } from "@/features/tasks/today-logic";
import { addDays, formatDate, relativeDateLabel } from "@/lib/dates";
import { instantToLocal } from "@/lib/dates/zoned";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Today" };

/** How far ahead "Coming up" looks. */
const COMING_UP_DAYS = 3;

/**
 * Today: what to do now. Execution on the left (priorities, overdue, due today, habits); time on
 * the right (the day's schedule, a focus timer, a reflection prompt). The Dashboard is the
 * broader overview; this page is for getting through the day.
 */
export default async function TodayPage() {
  const ctx = await getWorkspaceContext();
  const lookups = await loadLookups(ctx);
  const [data, habits] = await Promise.all([
    loadToday(ctx, lookups),
    loadHabitsForDay(ctx, ctx.today),
  ]);
  const now = new Date();

  // A task that is one of today's priorities is listed once, under Priorities.
  const priorityTaskIds = new Set(
    data.priorities.flatMap((item) => (item.kind === "task" ? [item.task.id] : [])),
  );
  const notPriority = <T extends { id: string }>(list: T[]) =>
    list.filter((t) => !priorityTaskIds.has(t.id));
  const overdue = notPriority(data.overdue);
  const dueToday = notPriority(data.dueToday);
  const comingUp = data.upcoming.filter((t) => t.due_date! <= addDays(ctx.today, COMING_UP_DAYS));

  const agenda = buildDayAgenda({
    blocks: data.scheduled,
    deadlines: data.dueToday.flatMap((t) =>
      t.due_time ? [{ id: t.id, title: t.title, due_time: t.due_time, status: t.status }] : [],
    ),
    today: ctx.today,
    timezone: ctx.timezone,
    now,
  });
  const nextBlock = agenda.find(
    (i): i is Extract<typeof i, { kind: "block" }> => i.kind === "block" && i.state === "upcoming",
  );
  const habitsDone = habits.filter((h) => isDone(h.habit, h.log ?? undefined)).length;
  const summary = summarizeToday({
    overdue: data.overdue.length,
    dueToday: data.dueToday.length,
    completedToday: data.completedToday.length,
    habitsDone,
    habitsDue: habits.length,
    scheduledToday: data.scheduled.length,
    next: nextBlock
      ? { title: nextBlock.title, time: instantToLocal(nextBlock.start, ctx.timezone).time }
      : null,
  });

  // Tasks worth focusing on today, for the timer's "Working on".
  const focusTasks = [
    ...data.priorities.flatMap((i) => (i.kind === "task" ? [i.task] : [])),
    ...data.overdue,
    ...data.dueToday,
  ]
    .filter((t, i, all) => t.status !== "done" && all.findIndex((x) => x.id === t.id) === i)
    .map((t) => ({ id: t.id, title: t.title, project_id: t.project_id }));
  const projectNames = Object.fromEntries(lookups.projects.map((p) => [p.id, p.name]));
  const dayHref = plannerHref("day", ctx.today);
  // "tomorrow", or "on Sat, Nov 7" for later dates.
  const whenLabel = (date: string) => {
    const label = relativeDateLabel(date, ctx.today);
    return label === "Tomorrow" ? "tomorrow" : `on ${label}`;
  };

  const tasks = (
    <>
      <QuickAddTask defaultDueDate={ctx.today} placeholder="Add a task for today" compact />

      <Section
        title="Priorities"
        count={data.priorities.length || undefined}
        actions={
          <Link href={dayHref} className="text-accent hover:underline">
            {data.dayPlanId ? "Edit day plan" : "Plan the day"}
          </Link>
        }
      >
        {data.priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No priorities yet. Pick one to three things that matter most in the{" "}
            <Link href={dayHref} className="text-accent hover:underline">
              day plan
            </Link>
            .
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
      </Section>

      {overdue.length > 0 && (
        <Section
          title="Overdue"
          count={overdue.length}
          tone="danger"
          actions={<RescheduleOverdue tasks={overdue} today={ctx.today} />}
        >
          <TaskList tasks={overdue} today={ctx.today} label="Overdue" />
        </Section>
      )}

      <Section title="Due today" count={dueToday.length}>
        {dueToday.length === 0 ? (
          <EmptyState title={overdue.length === 0 ? "Nothing due today" : "Nothing else due today"}>
            {comingUp[0]
              ? `Next deadline: ${comingUp[0].title}, ${whenLabel(comingUp[0].due_date!)}.`
              : "Enjoy the space, or pull something forward."}
          </EmptyState>
        ) : (
          <TaskList tasks={dueToday} today={ctx.today} label="Due today" />
        )}
      </Section>

      {habits.length > 0 && (
        <Section
          title="Habits"
          count={`${habitsDone}/${habits.length}`}
          actions={
            <Link href="/habits" className="text-accent hover:underline">
              All habits
            </Link>
          }
        >
          <HabitList summaries={habits} date={ctx.today} today={ctx.today} label="Today's habits" />
        </Section>
      )}

      {comingUp.length > 0 && (
        <Section title="Coming up" variant="label" count={comingUp.length} divider>
          <TaskList tasks={comingUp} today={ctx.today} label="Coming up" />
        </Section>
      )}

      {data.completedToday.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Completed today · {data.completedToday.length}
          </summary>
          <div className="mt-2">
            <TaskList tasks={data.completedToday} today={ctx.today} label="Completed today" />
          </div>
        </details>
      )}
    </>
  );

  const schedule = (
    <>
      <Section
        title="Schedule"
        variant="label"
        actions={
          <Link href={dayHref} className="text-accent hover:underline">
            Open in Planner
          </Link>
        }
      >
        <DayAgenda items={agenda} timezone={ctx.timezone} today={ctx.today} />
      </Section>
      <Section title="Focus" variant="label" divider>
        <FocusTimer tasks={focusTasks} projectNames={projectNames} />
      </Section>
      <Section title="Reflect" variant="label" divider>
        <JournalPromptCard prompt={dailyPrompt(ctx.today)} today={ctx.today} />
      </Section>
    </>
  );

  return (
    <>
      <PageHeader
        title="Today"
        description={formatDate(ctx.today)}
        meta={<p className="max-w-prose text-[0.9375rem] text-foreground">{summary}</p>}
      />
      <div className="-mt-4 mb-8 max-w-xl">
        <InlineText
          key={`theme-day-${ctx.today}`}
          period="day"
          start={ctx.today}
          field="theme"
          value={data.dayTheme}
          label="Intention"
          placeholder="What would make today a good day?"
          maxLength={200}
        />
      </div>
      <TodayLayout tasks={tasks} schedule={schedule} />
    </>
  );
}
