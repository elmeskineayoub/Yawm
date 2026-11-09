import { CheckCircle2, Circle, Moon, Play } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TaskList } from "@/components/tasks/task-row";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import type { DashboardModel } from "@/features/dashboard/model";
import type { DashboardSection } from "@/features/dashboard/sections";
import { formatDuration } from "@/features/focus/logic";
import { plannerHref } from "@/features/planning/view";
import { relativeDateLabel, type IsoDate } from "@/lib/dates";
import { formatTimeRange } from "@/lib/dates/zoned";
import { cn } from "@/lib/utils";
import { FocusWeekChart } from "./focus-week-chart";
import { Meter } from "@/components/ui/meter";
import { NextUp } from "./next-up";

/** How many tasks each attention group lists before pointing elsewhere. */
const LIST_CAP = 4;

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

/** A target date short enough for a row: relative this year, "Apr 2027" beyond it. */
function targetLabel(date: IsoDate, today: IsoDate): string {
  if (date.slice(0, 4) === today.slice(0, 4)) return relativeDateLabel(date, today);
  return MONTH_YEAR.format(new Date(`${date}T00:00:00Z`));
}

const linkClass = "text-link";

function MoreLink({ count, href, label }: { count: number; href: string; label: string }) {
  if (count <= 0) return null;
  return (
    <p className="mt-1 text-sm">
      <Link href={href} className={linkClass}>
        {count} more {label}
      </Link>
    </p>
  );
}

function GroupLabel({ children, tone }: { children: ReactNode; tone?: "danger" }) {
  return (
    <h3 className={cn("label-caps mb-0.5", tone === "danger" && "text-danger")}>{children}</h3>
  );
}

/**
 * The Dashboard, rendered from its view model only. Layout:
 * - phone: one column in reading order (next up, today, attention, habits, week, projects, goals,
 *   reflect);
 * - tablet: a two-column grid where the lists span both columns and the small blocks pair up;
 * - desktop: the work (next up, attention, projects) on the left, the day and the week on the right.
 * The two column wrappers are `display: contents` below `lg`, so their children join the outer grid
 * and take their `order` from there.
 */
export function DashboardView({
  model,
  today,
  timezone,
  dateLabel,
  hidden,
  customize,
  reflect,
}: {
  model: DashboardModel;
  today: IsoDate;
  timezone: string;
  /** The user's date, already formatted. */
  dateLabel: string;
  hidden: ReadonlySet<DashboardSection>;
  customize?: ReactNode;
  /** The reflection prompt (a client component), when that section is shown. */
  reflect?: ReactNode;
}) {
  const show = (key: DashboardSection) => !hidden.has(key);
  const { attention, today: day, week } = model;
  const visible = (["attention", "today", "week", "progress", "reflect"] as const).filter(show);

  // Tablet pairs: a block spans both columns when its partner is hidden.
  const pairHabitsWeek = show("today") && show("week");
  const pairGoalsReflect = show("progress") && show("reflect");

  const blocks = {
    nextUp: show("attention") && <NextUp nextUp={model.nextUp} />,

    today: show("today") && (
      <Section
        title="Today"
        actions={
          <Link href="/today" className={linkClass}>
            Open Today
          </Link>
        }
      >
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-2">
          {[
            {
              label: "Overdue",
              value: day.overdue,
              href: "/tasks?due=overdue",
              tone: day.overdue > 0 ? "danger" : undefined,
            },
            { label: "Due today", value: day.dueToday, href: "/tasks?due=today" },
            {
              label: "Habits done",
              value:
                day.habitsDue === null || day.habitsDue === 0
                  ? "—"
                  : `${day.habitsDone}/${day.habitsDue}`,
              href: "/habits",
            },
            {
              label: "Focus today",
              value: formatDuration(day.focusSeconds),
              href: "/focus",
            },
          ].map((s) => (
            <div key={s.label} className="bg-background">
              <Link
                href={s.href}
                className="block h-full px-3.5 py-3 transition-colors hover:bg-surface"
              >
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-xl font-semibold tabular-nums",
                    s.tone === "danger" && "text-danger",
                  )}
                >
                  {s.value}
                </dd>
              </Link>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm">
          {day.nextBlock ? (
            <>
              <span className="text-muted-foreground">Next block </span>
              <Link href={plannerHref("day", today)} className={linkClass}>
                {formatTimeRange(day.nextBlock.start, day.nextBlock.end, timezone)}{" "}
                {day.nextBlock.title}
              </Link>
            </>
          ) : (
            <span className="text-muted-foreground">
              {day.blocks === 0 ? "Nothing scheduled today. " : "No more blocks today. "}
              <Link href={plannerHref("day", today)} className={linkClass}>
                Plan your time
              </Link>
            </span>
          )}
        </p>
      </Section>
    ),

    attention: show("attention") && (
      <Section
        title="Needs attention"
        actions={
          <Link href="/tasks?due=week" className={linkClass}>
            All deadlines
          </Link>
        }
      >
        {attention.overdue.length === 0 &&
        attention.dueToday.length === 0 &&
        attention.upcoming.length === 0 &&
        attention.milestones.length === 0 &&
        attention.inbox === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing overdue, nothing due this week, and the inbox is clear.
          </p>
        ) : (
          <div className="space-y-5">
            {attention.overdue.length > 0 && (
              <div>
                <GroupLabel tone="danger">Overdue · {attention.overdue.length}</GroupLabel>
                <TaskList
                  tasks={attention.overdue.slice(0, LIST_CAP)}
                  today={today}
                  label="Overdue"
                />
                <MoreLink
                  count={attention.overdue.length - LIST_CAP}
                  href="/tasks?due=overdue"
                  label="overdue"
                />
              </div>
            )}
            {attention.dueToday.length > 0 && (
              <div>
                <GroupLabel>Due today · {attention.dueToday.length}</GroupLabel>
                <TaskList
                  tasks={attention.dueToday.slice(0, LIST_CAP)}
                  today={today}
                  label="Due today"
                />
                <MoreLink
                  count={attention.dueToday.length - LIST_CAP}
                  href="/tasks?due=today"
                  label="due today"
                />
              </div>
            )}
            {attention.upcoming.length > 0 && (
              <div>
                <GroupLabel>Next 7 days · {attention.upcoming.length}</GroupLabel>
                <ul aria-label="Next 7 days">
                  {attention.upcoming.slice(0, LIST_CAP).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-baseline gap-3 border-b border-border py-2 text-sm last:border-b-0"
                    >
                      <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                        {relativeDateLabel(t.due_date!, today)}
                      </span>
                      <Link
                        href={`/tasks/${t.id}`}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {t.title}
                      </Link>
                      {t.project && (
                        <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:block">
                          {t.project.name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <MoreLink
                  count={attention.upcoming.length - LIST_CAP}
                  href="/tasks?due=week"
                  label="this week"
                />
              </div>
            )}
            {attention.milestones.length > 0 && (
              <div>
                <GroupLabel>Milestones due soon</GroupLabel>
                <ul className="text-sm">
                  {attention.milestones.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-baseline gap-x-2 border-b border-border py-2 last:border-b-0"
                    >
                      <Link href={`/goals/${m.goal_id}`} className="hover:underline">
                        {m.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {m.goal_title} · {relativeDateLabel(m.due_date!, today)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {attention.inbox > 0 && (
              <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md bg-surface-muted/60 px-3.5 py-2.5 text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{attention.inbox}</span> idea
                  {attention.inbox === 1 ? "" : "s"} waiting in the Inbox
                </span>
                <Link href="/inbox" className={linkClass}>
                  Sort the inbox
                </Link>
              </p>
            )}
          </div>
        )}
      </Section>
    ),

    habits: show("today") && model.habits && (
      <Section
        title="Habits today"
        count={
          model.habits.length > 0
            ? `${model.habits.filter((h) => h.done).length}/${model.habits.length}`
            : undefined
        }
        actions={
          <Link href="/today" className={linkClass}>
            Check in
          </Link>
        }
      >
        {model.habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No habits are due today.{" "}
            <Link href="/habits" className={linkClass}>
              Manage habits
            </Link>
          </p>
        ) : (
          <ul aria-label="Habits due today">
            {model.habits.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-2.5 border-b border-border py-2 text-sm last:border-b-0"
              >
                {h.done ? (
                  <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
                ) : h.rest ? (
                  <Moon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Circle aria-hidden className="size-4 shrink-0 text-input-border" />
                )}
                <Link
                  href={`/habits/${h.id}`}
                  className={cn(
                    "min-w-0 flex-1 truncate hover:underline",
                    h.done && "text-muted-foreground",
                  )}
                >
                  {h.title}
                  <span className="sr-only">
                    {h.done ? " (done)" : h.rest ? " (rest day)" : " (not done yet)"}
                  </span>
                </Link>
                {h.progress && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {h.progress}
                  </span>
                )}
                <span
                  className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
                  title={h.streak}
                >
                  {h.streakShort}
                  <span className="sr-only"> ({h.streak})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    ),

    week: show("week") && (
      <Section
        title="This week"
        actions={
          <Link href="/reviews" className={linkClass}>
            Review
          </Link>
        }
      >
        <p
          className={cn("font-serif text-lg leading-snug", !week.theme && "text-muted-foreground")}
        >
          {week.theme ?? (
            <>
              No focus set for this week.{" "}
              <Link
                href={plannerHref("week", today)}
                className={cn(linkClass, "font-sans text-sm")}
              >
                Set one
              </Link>
            </>
          )}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Tasks done</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {week.completed}
              {week.taskRate !== null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {week.taskRate}% of due
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Habits kept</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {week.habitRate === null ? "—" : `${week.habitRate}%`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Focus</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {formatDuration(week.focusSeconds)}
            </dd>
          </div>
        </dl>
        {week.focusByDay && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs text-muted-foreground">Focus per day</h3>
            <FocusWeekChart days={week.focusByDay} />
          </div>
        )}
      </Section>
    ),

    projects: show("progress") && (
      <Section
        title="Active projects"
        count={model.projects.length}
        actions={
          <Link href="/projects" className={linkClass}>
            All projects
          </Link>
        }
      >
        {model.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active projects.{" "}
            <Link href="/projects" className={linkClass}>
              Start a project
            </Link>
          </p>
        ) : (
          <ul aria-label="Active projects" className="border-t border-border">
            {model.projects.map((p) => (
              <li
                key={p.id}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-border py-3 sm:grid-cols-[minmax(0,1fr)_9rem_4.5rem_8.5rem]"
              >
                <div className="min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {p.area && (
                      <>
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full ring-1 ring-foreground/20 ring-inset"
                          style={{ backgroundColor: p.area.color }}
                        />
                        <span className="shrink-0">{p.area.name}</span>
                        <span aria-hidden>·</span>
                      </>
                    )}
                    <span className="truncate">
                      {p.next ? `Next: ${p.next.title}` : `${p.openTasks} open`}
                    </span>
                  </p>
                </div>
                <div className="col-span-2 row-start-2 flex items-center gap-2 sm:col-span-1 sm:row-start-auto">
                  <Meter
                    percent={p.percent}
                    label={`${p.name} progress`}
                    valueText={`${p.done} of ${p.total} tasks done`}
                    className="flex-1"
                  />
                  <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                    {p.percent}%
                  </span>
                </div>
                <span
                  className="hidden text-right text-xs text-muted-foreground tabular-nums sm:block"
                  title="Focus this week"
                >
                  {p.focusWeekSeconds > 0 ? formatDuration(p.focusWeekSeconds) : "—"}
                  <span className="sr-only"> focus this week</span>
                </span>
                <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:col-start-auto sm:row-start-auto">
                  {p.dueDate && <Badge tone={p.dueTone}>{targetLabel(p.dueDate, today)}</Badge>}
                  <Link
                    href={`/focus?project=${p.id}`}
                    aria-label={`Start focus on ${p.name}`}
                    className={buttonClass({
                      variant: "ghost",
                      size: "icon",
                      className: "size-11 sm:size-9",
                    })}
                  >
                    <Play aria-hidden className="size-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    ),

    goals: show("progress") && (
      <Section
        title="Goals"
        count={model.goals.length}
        actions={
          <Link href="/goals" className={linkClass}>
            All goals
          </Link>
        }
      >
        {model.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active goals.{" "}
            <Link href="/goals" className={linkClass}>
              Set a goal
            </Link>
          </p>
        ) : (
          <ul aria-label="Active goals" className="space-y-4">
            {model.goals.map((g) => (
              <li key={g.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/goals/${g.id}`}
                    className="min-w-0 truncate text-sm hover:underline"
                  >
                    {g.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {g.progressLabel}
                  </span>
                </div>
                <Meter
                  percent={g.percent}
                  label={`${g.title} progress`}
                  valueText={g.progressLabel}
                  className="mt-1.5"
                />
                {(g.next || g.targetDate) && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {g.next
                      ? `Next: ${g.next.title}${g.next.dueDate ? ` · ${relativeDateLabel(g.next.dueDate, today)}` : ""}`
                      : `Target ${targetLabel(g.targetDate!, today)}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    ),

    reflect: show("reflect") && reflect && <Section title="Reflect">{reflect}</Section>,
  };

  // order-*: phone and tablet reading order. lg:order-none hands control back to the columns.
  const slot = (node: ReactNode, order: string, span: boolean) =>
    node ? (
      <div className={cn("min-w-0", order, span && "md:col-span-2", "lg:order-none")}>{node}</div>
    ) : null;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={dateLabel}
        meta={<p className="max-w-prose text-[0.9375rem] text-foreground">{model.summary}</p>}
        actions={customize}
      />
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All sections are hidden. Use Customize to show them again.
        </p>
      ) : (
        <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-x-12">
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-10">
            {slot(blocks.nextUp, "order-1", true)}
            {slot(blocks.attention, "order-3", true)}
            {slot(blocks.projects, "order-6", true)}
          </div>
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-10">
            {slot(blocks.today, "order-2", true)}
            {slot(blocks.habits, "order-4", !pairHabitsWeek)}
            {slot(blocks.week, "order-5", !pairHabitsWeek)}
            {slot(blocks.goals, "order-7", !pairGoalsReflect)}
            {slot(blocks.reflect, "order-8", !pairGoalsReflect)}
          </div>
        </div>
      )}
    </div>
  );
}
