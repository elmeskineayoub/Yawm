import { CheckCircle2, Circle, Moon, Play } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TaskList } from "@/components/tasks/task-row";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, PageSection } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import type { DashboardModel } from "@/features/dashboard/model";
import type { DashboardSection } from "@/features/dashboard/sections";
import { formatDuration } from "@/features/focus/logic";
import { plannerHref } from "@/features/planning/view";
import { relativeDateLabel, type IsoDate } from "@/lib/dates";
import { formatTimeRange } from "@/lib/dates/zoned";
import { cn } from "@/lib/utils";
import { FocusWeekChart } from "./focus-week-chart";
import { NextUp } from "./next-up";

/** How many rows each attention card lists before pointing elsewhere. */
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

/** A standalone text link: underlined, and a full 44px target on touch screens. */
const actionLink = "tap-target text-link";

/** A row's title link: one truncated line, the whole line a 44px target on touch screens. */
function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 items-center text-sm hover:underline pointer-coarse:min-h-tap",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </Link>
  );
}

const rowClass = "border-b border-border py-2 last:border-b-0 last:pb-0 pointer-coarse:py-1";

function MoreLink({ count, href, label }: { count: number; href: string; label: string }) {
  if (count <= 0) return null;
  return (
    <p className="mt-2 text-sm">
      <Link href={href} className={actionLink}>
        {count} more {label}
      </Link>
    </p>
  );
}

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  href: string;
  tone?: "danger";
}) {
  return (
    <div>
      <Link
        href={href}
        className="-m-2 block rounded-control p-2 transition-colors hover:bg-surface-muted"
      >
        <dt className="text-caption text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            "mt-0.5 text-xl font-semibold tabular-nums",
            tone === "danger" && "text-danger",
          )}
        >
          {value}
        </dd>
      </Link>
    </div>
  );
}

/**
 * The Dashboard, rendered from its view model only, on the shared card system:
 *
 *   h1  Dashboard                      page title
 *   h2  Now / Needs attention / …      page sections, 48px apart on phones and 64px on desktop
 *   h3  cards                          one card pattern; 16px padding on phones, 24px on desktop
 *
 * "Next up" is the page's primary block and holds its only filled button. Sections stack in
 * reading order on phones; from `lg` the cards inside a section sit side by side on a 12-column
 * grid. Standalone links and controls are 44px targets on touch screens.
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
  const anyVisible = (["attention", "today", "week", "progress", "reflect"] as const).some(show);
  const grid = "grid gap-gutter lg:grid-cols-12";

  const todayCard = (wide: boolean) => (
    <Card
      title="Today"
      className={wide ? "lg:col-span-12" : "lg:col-span-4"}
      actions={
        <Link href="/today" className={actionLink}>
          Open Today
        </Link>
      }
    >
      <dl
        className={cn("grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4", !wide && "lg:grid-cols-2")}
      >
        <Stat
          label="Overdue"
          value={day.overdue}
          href="/tasks?due=overdue"
          tone={day.overdue > 0 ? "danger" : undefined}
        />
        <Stat label="Due today" value={day.dueToday} href="/tasks?due=today" />
        <Stat
          label="Habits done"
          value={
            day.habitsDue === null || day.habitsDue === 0
              ? "—"
              : `${day.habitsDone}/${day.habitsDue}`
          }
          href="/habits"
        />
        <Stat label="Focus today" value={formatDuration(day.focusSeconds)} href="/focus" />
      </dl>
      <div className="mt-5 border-t border-border pt-3 text-sm">
        {day.nextBlock ? (
          <>
            <p className="text-caption text-muted-foreground">Next block</p>
            <Link href={plannerHref("day", today)} className={actionLink}>
              {formatTimeRange(day.nextBlock.start, day.nextBlock.end, timezone)}{" "}
              {day.nextBlock.title}
            </Link>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              {day.blocks === 0 ? "Nothing scheduled today." : "No more blocks today."}
            </p>
            <Link href={plannerHref("day", today)} className={actionLink}>
              Plan your time
            </Link>
          </>
        )}
      </div>
    </Card>
  );

  const attentionCards = [
    attention.overdue.length > 0 && (
      <Card key="overdue" title="Overdue" count={attention.overdue.length} tone="danger">
        <TaskList
          tasks={attention.overdue.slice(0, LIST_CAP)}
          today={today}
          label="Overdue"
          comfortable
        />
        <MoreLink
          count={attention.overdue.length - LIST_CAP}
          href="/tasks?due=overdue"
          label="overdue"
        />
      </Card>
    ),
    attention.dueToday.length > 0 && (
      <Card key="today" title="Due today" count={attention.dueToday.length}>
        <TaskList
          tasks={attention.dueToday.slice(0, LIST_CAP)}
          today={today}
          label="Due today"
          comfortable
        />
        <MoreLink
          count={attention.dueToday.length - LIST_CAP}
          href="/tasks?due=today"
          label="due today"
        />
      </Card>
    ),
    (attention.upcoming.length > 0 || attention.milestones.length > 0) && (
      <Card
        key="upcoming"
        title="Next 7 days"
        count={attention.upcoming.length}
        // As the third card it would sit alone on a two-column tablet row: let it fill the row.
        className={
          attention.overdue.length > 0 && attention.dueToday.length > 0
            ? "md:col-span-2 xl:col-span-1"
            : undefined
        }
      >
        {attention.upcoming.length > 0 && (
          <ul aria-label="Next 7 days">
            {attention.upcoming.slice(0, LIST_CAP).map((t) => (
              <li key={t.id} className={cn(rowClass, "flex items-center gap-3")}>
                <span className="w-20 shrink-0 text-caption text-muted-foreground tabular-nums">
                  {relativeDateLabel(t.due_date!, today)}
                </span>
                <RowLink href={`/tasks/${t.id}`} className="flex-1">
                  {t.title}
                </RowLink>
              </li>
            ))}
          </ul>
        )}
        <MoreLink
          count={attention.upcoming.length - LIST_CAP}
          href="/tasks?due=week"
          label="this week"
        />
        {attention.milestones.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <h4 className="text-caption font-medium text-muted-foreground">Milestones due soon</h4>
            <ul aria-label="Milestones due soon">
              {attention.milestones.map((m) => (
                <li key={m.id} className={rowClass}>
                  <RowLink href={`/goals/${m.goal_id}`}>{m.title}</RowLink>
                  <p className="truncate text-caption text-muted-foreground">
                    {m.goal_title} · {relativeDateLabel(m.due_date!, today)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    ),
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={dateLabel}
        meta={<p className="max-w-prose text-base text-foreground">{model.summary}</p>}
        actions={customize}
      />
      {!anyVisible ? (
        <p className="text-sm text-muted-foreground">
          All sections are hidden. Use Customize to show them again.
        </p>
      ) : (
        <div className="space-y-section-sm lg:space-y-section">
          {(show("attention") || show("today")) && (
            <PageSection title="Now">
              <div className={grid}>
                {show("attention") && (
                  <NextUp
                    nextUp={model.nextUp}
                    className={show("today") ? "lg:col-span-8" : "lg:col-span-12"}
                  />
                )}
                {show("today") && todayCard(!show("attention"))}
              </div>
            </PageSection>
          )}

          {show("attention") && (
            <PageSection
              title="Needs attention"
              actions={
                <Link href="/tasks?due=week" className={actionLink}>
                  All deadlines
                </Link>
              }
            >
              {attentionCards.length === 0 && attention.inbox === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing overdue, nothing due this week, and the inbox is clear.
                </p>
              ) : (
                <div className="space-y-gutter">
                  {attentionCards.length > 0 && (
                    <div
                      className={cn(
                        "grid gap-gutter",
                        attentionCards.length > 1 && "md:grid-cols-2",
                        attentionCards.length > 2 && "xl:grid-cols-3",
                      )}
                    >
                      {attentionCards}
                    </div>
                  )}
                  {attention.inbox > 0 && (
                    <p className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-card border border-border bg-surface px-card-sm py-3 text-sm sm:px-card">
                      <span>
                        <span className="font-semibold tabular-nums">{attention.inbox}</span> idea
                        {attention.inbox === 1 ? "" : "s"} waiting in the Inbox
                      </span>
                      <Link href="/inbox" className={actionLink}>
                        Sort the inbox
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </PageSection>
          )}

          {(show("week") || (show("today") && model.habits)) && (
            <PageSection
              title="This week"
              actions={
                show("week") && (
                  <Link href="/reviews" className={actionLink}>
                    Weekly review
                  </Link>
                )
              }
            >
              <div className={grid}>
                {show("week") && (
                  <Card
                    title="Focus of the week"
                    className={show("today") && model.habits ? "lg:col-span-7" : "lg:col-span-12"}
                  >
                    <p
                      className={cn(
                        "font-serif text-lg leading-snug",
                        !week.theme && "font-sans text-sm text-muted-foreground",
                      )}
                    >
                      {week.theme ?? "No focus set for this week."}
                    </p>
                    {!week.theme && (
                      <Link href={plannerHref("week", today)} className={actionLink}>
                        Set a weekly focus
                      </Link>
                    )}
                    <dl className="mt-5 grid grid-cols-3 gap-x-6 border-t border-border pt-4">
                      <div>
                        <dt className="text-caption text-muted-foreground">Tasks done</dt>
                        <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                          {week.completed}
                        </dd>
                        {week.taskRate !== null && (
                          <dd className="text-caption text-muted-foreground tabular-nums">
                            {week.taskRate}% of due
                          </dd>
                        )}
                      </div>
                      <div>
                        <dt className="text-caption text-muted-foreground">Habits kept</dt>
                        <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                          {week.habitRate === null ? "—" : `${week.habitRate}%`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-caption text-muted-foreground">Focus time</dt>
                        <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                          {formatDuration(week.focusSeconds)}
                        </dd>
                      </div>
                    </dl>
                    {week.focusByDay && (
                      <div className="mt-5">
                        <h4 className="mb-2 text-caption text-muted-foreground">
                          Focus time per day
                        </h4>
                        <FocusWeekChart days={week.focusByDay} />
                      </div>
                    )}
                  </Card>
                )}

                {show("today") && model.habits && (
                  <Card
                    title="Habits today"
                    count={
                      model.habits.length > 0
                        ? `${model.habits.filter((h) => h.done).length}/${model.habits.length}`
                        : undefined
                    }
                    className={show("week") ? "lg:col-span-5" : "lg:col-span-12"}
                    actions={
                      <Link href="/today" className={actionLink}>
                        Check in
                      </Link>
                    }
                  >
                    {model.habits.length === 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">No habits are due today.</p>
                        <Link href="/habits" className={actionLink}>
                          Manage habits
                        </Link>
                      </>
                    ) : (
                      <ul aria-label="Habits due today">
                        {model.habits.map((h) => (
                          <li key={h.id} className={cn(rowClass, "flex items-center gap-3")}>
                            {h.done ? (
                              <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
                            ) : h.rest ? (
                              <Moon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <Circle aria-hidden className="size-4 shrink-0 text-input-border" />
                            )}
                            <RowLink
                              href={`/habits/${h.id}`}
                              className={cn("flex-1", h.done && "text-muted-foreground")}
                            >
                              {h.title}
                              <span className="sr-only">
                                {h.done ? " (done)" : h.rest ? " (rest day)" : " (not done yet)"}
                              </span>
                            </RowLink>
                            {h.progress && (
                              <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                                {h.progress}
                              </span>
                            )}
                            <span
                              className="w-10 shrink-0 text-right text-caption text-muted-foreground tabular-nums"
                              title={h.streak}
                            >
                              {h.streakShort}
                              <span className="sr-only"> ({h.streak})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )}
              </div>
            </PageSection>
          )}

          {show("progress") && (
            <PageSection title="Progress">
              <div className={grid}>
                <Card
                  title="Active projects"
                  count={model.projects.length}
                  className="lg:col-span-8"
                  actions={
                    <Link href="/projects" className={actionLink}>
                      All projects
                    </Link>
                  }
                >
                  {model.projects.length === 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">No active projects.</p>
                      <Link href="/projects" className={actionLink}>
                        Start a project
                      </Link>
                    </>
                  ) : (
                    <ul aria-label="Active projects">
                      {model.projects.map((p) => (
                        <li
                          key={p.id}
                          className={cn(
                            rowClass,
                            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_8rem_4rem_7.5rem]",
                          )}
                        >
                          <div className="min-w-0">
                            <RowLink href={`/projects/${p.id}`} className="font-medium">
                              {p.name}
                            </RowLink>
                            <p className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
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
                            <span className="w-9 text-right text-caption text-muted-foreground tabular-nums">
                              {p.percent}%
                            </span>
                          </div>
                          <span
                            className="hidden text-right text-caption text-muted-foreground tabular-nums sm:block"
                            title="Focus this week"
                          >
                            {p.focusWeekSeconds > 0 ? formatDuration(p.focusWeekSeconds) : "—"}
                            <span className="sr-only"> focus this week</span>
                          </span>
                          <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:col-start-auto sm:row-start-auto">
                            {p.dueDate && (
                              <Badge tone={p.dueTone}>{targetLabel(p.dueDate, today)}</Badge>
                            )}
                            <Link
                              href={`/focus?project=${p.id}`}
                              aria-label={`Start focus on ${p.name}`}
                              className={buttonClass({
                                variant: "ghost",
                                size: "icon",
                                className: "shrink-0 pointer-coarse:size-tap",
                              })}
                            >
                              <Play aria-hidden className="size-4" />
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card
                  title="Goals"
                  count={model.goals.length}
                  className="lg:col-span-4"
                  actions={
                    <Link href="/goals" className={actionLink}>
                      All goals
                    </Link>
                  }
                >
                  {model.goals.length === 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">No active goals.</p>
                      <Link href="/goals" className={actionLink}>
                        Set a goal
                      </Link>
                    </>
                  ) : (
                    <ul aria-label="Active goals">
                      {model.goals.map((g) => (
                        <li key={g.id} className={cn(rowClass, "pb-3")}>
                          <RowLink href={`/goals/${g.id}`} className="font-medium">
                            {g.title}
                          </RowLink>
                          <div className="mt-1 flex items-center gap-2 pointer-coarse:mt-0">
                            <Meter
                              percent={g.percent}
                              label={`${g.title} progress`}
                              valueText={g.progressLabel}
                              className="flex-1"
                            />
                            <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                              {g.progressLabel}
                            </span>
                          </div>
                          {(g.next || g.targetDate) && (
                            <p className="mt-1.5 truncate text-caption text-muted-foreground">
                              {g.next
                                ? `Next: ${g.next.title}${g.next.dueDate ? ` · ${relativeDateLabel(g.next.dueDate, today)}` : ""}`
                                : `Target ${targetLabel(g.targetDate!, today)}`}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </PageSection>
          )}

          {show("reflect") && reflect && (
            <PageSection title="Reflect">
              <Card title="Today's prompt">{reflect}</Card>
            </PageSection>
          )}
        </div>
      )}
    </div>
  );
}
