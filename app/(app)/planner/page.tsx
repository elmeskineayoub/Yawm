import type { Metadata } from "next";
import Link from "next/link";
import { CarryForwardButton } from "@/components/planner/carry-forward";
import { InlineText } from "@/components/planner/inline-text";
import { PlannerHeader } from "@/components/planner/planner-header";
import { PlannerWorkspace } from "@/components/planner/planner-workspace";
import { PriorityList } from "@/components/planner/priority-list";
import { ProgressBar } from "@/components/ui/progress-bar";
import { loadPlanner, type PlannerData } from "@/features/planning/planner";
import { parsePlannerParams, plannerHref } from "@/features/planning/view";
import { isOpen } from "@/features/tasks/logic";
import {
  formatPeriodShort,
  formatPeriodTitle,
  periodEnd,
  shiftPeriod,
  type IsoDate,
  type PlanPeriod,
} from "@/lib/dates";
import { isoWeekNumber } from "@/lib/dates/zoned";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Planner" };

/** What each period is for. Shown as the focus panel's copy and empty states. */
const PURPOSE: Record<
  PlanPeriod,
  {
    intentionLabel: string;
    intentionPlaceholder: string;
    listHeading: string;
    addLabel: string;
    empty: string;
    kind: "task" | "project";
    softLimit?: number;
  }
> = {
  year: {
    intentionLabel: "Direction",
    intentionPlaceholder: "Set a theme for the year…",
    listHeading: "Major outcomes",
    addLabel: "Add an outcome",
    empty: "Name the few outcomes that would make this year a success. Each becomes a project.",
    kind: "project",
  },
  month: {
    intentionLabel: "Theme",
    intentionPlaceholder: "What is this month about?",
    listHeading: "Outcomes",
    addLabel: "Add an outcome",
    empty: "What should this month move forward? Add outcomes, or link projects you already have.",
    kind: "project",
  },
  week: {
    intentionLabel: "Focus",
    intentionPlaceholder: "What matters most this week?",
    listHeading: "Priorities",
    addLabel: "Add a priority",
    empty: "Choose a short list of tasks that would make this week count.",
    kind: "task",
    softLimit: 5,
  },
  day: {
    intentionLabel: "Intention",
    intentionPlaceholder: "What would make today a good day?",
    listHeading: "Priorities",
    addLabel: "Add a priority",
    empty: "Pick one to three things that matter most, then give them time on the timeline.",
    kind: "task",
    softLimit: 3,
  },
};

function FocusPanel({
  view,
  start,
  data,
  nextLabel,
  canCarry,
}: {
  view: PlanPeriod;
  start: IsoDate;
  data: PlannerData;
  nextLabel: string;
  canCarry: boolean;
}) {
  const purpose = PURPOSE[view];
  const openPriorities = data.items.filter(
    (i) => i.kind === "task" && isOpen(i.task.status),
  ).length;
  const plan = data.plan;

  return (
    <div className="space-y-5">
      <InlineText
        key={`theme-${view}-${start}`}
        period={view}
        start={start}
        field="theme"
        value={plan?.theme ?? null}
        label={purpose.intentionLabel}
        placeholder={purpose.intentionPlaceholder}
        maxLength={200}
      />
      <div>
        <PriorityList
          key={`list-${view}-${start}`}
          period={view}
          start={start}
          items={data.items}
          kind={purpose.kind}
          heading={purpose.listHeading}
          addLabel={purpose.addLabel}
          emptyText={purpose.empty}
          softLimit={purpose.softLimit}
        />
        {data.progress.total > 0 && (
          <div className="mt-2 px-1">
            <ProgressBar progress={data.progress} label={`${purpose.listHeading} progress`} />
          </div>
        )}
        {view !== "year" && canCarry && (
          <div className="mt-1">
            <CarryForwardButton
              period={view}
              start={start}
              openCount={openPriorities}
              nextLabel={nextLabel}
            />
          </div>
        )}
      </div>
      <details className="group rounded-md">
        <summary className="cursor-pointer px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Notes & review
        </summary>
        <div className="mt-2 space-y-3">
          <InlineText
            key={`focus-${view}-${start}`}
            period={view}
            start={start}
            field="focus"
            value={plan?.focus ?? null}
            label="Notes"
            placeholder="Anything to remember while planning…"
            multiline
            maxLength={5000}
          />
          <InlineText
            key={`reflection-${view}-${start}`}
            period={view}
            start={start}
            field="reflection"
            value={plan?.reflection ?? null}
            label="Review"
            placeholder="How did it go? What carries over?"
            multiline
            maxLength={10000}
          />
        </div>
      </details>
    </div>
  );
}

function ContextChips({ data }: { data: PlannerData }) {
  if (data.context.length === 0) return null;
  return (
    <nav aria-label="Part of" className="mb-4 flex flex-wrap gap-1.5 text-xs">
      {data.context.map((c) => (
        <Link
          key={c.period}
          href={plannerHref(c.period, c.start)}
          className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <span className="font-medium text-foreground">
            {formatPeriodShort(c.period, c.start)}
          </span>
          {c.theme && <span> · {c.theme}</span>}
        </Link>
      ))}
    </nav>
  );
}

function YearGrid({ data, today }: { data: PlannerData; today: IsoDate }) {
  const thisMonth = `${today.slice(0, 7)}-01`;
  return (
    <section aria-label="Months">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {data.children.map((month) => (
          <li key={month.start}>
            <Link
              href={plannerHref("month", month.start)}
              aria-current={month.start === thisMonth ? "date" : undefined}
              className={cn(
                "block h-full rounded-lg border border-border bg-surface p-3 hover:bg-surface-muted",
                month.start === thisMonth && "border-accent",
              )}
            >
              <span className="text-sm font-semibold">
                {formatPeriodShort("month", month.start)}
              </span>
              <span
                className={cn(
                  "mt-1 block text-sm break-words",
                  !month.plan?.theme && "text-muted-foreground",
                )}
              >
                {month.plan?.theme ?? "No theme yet"}
              </span>
              {month.itemCount > 0 && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {month.itemCount} linked
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getWorkspaceContext();
  const { view, start } = parsePlannerParams(await searchParams, ctx.today, ctx.weekStart);
  const end = periodEnd(view, start);
  const isCurrent = ctx.today >= start && ctx.today < end;
  const data = await loadPlanner(ctx, view, start);

  const next = shiftPeriod(view, start, 1);
  const nextLabel =
    view === "day" && isCurrent
      ? "tomorrow"
      : formatPeriodShort(view, next).replace("Week of ", "the week of ");
  const subtitle =
    view === "day"
      ? `${start.slice(0, 4)} · Week ${isoWeekNumber(start)}`
      : view === "week"
        ? `Week ${isoWeekNumber(start)}`
        : undefined;
  // Carrying forward makes sense for the current period and ones that have ended.
  const canCarry = ctx.today >= start;

  const focus = (
    <FocusPanel view={view} start={start} data={data} nextLabel={nextLabel} canCarry={canCarry} />
  );

  return (
    <>
      <PlannerHeader
        view={view}
        title={formatPeriodTitle(view, start)}
        subtitle={subtitle}
        isCurrent={isCurrent}
        viewHrefs={{
          day: plannerHref("day", isCurrent ? ctx.today : start),
          week: plannerHref("week", isCurrent ? ctx.today : start),
          month: plannerHref("month", isCurrent ? ctx.today : start),
          year: plannerHref("year", isCurrent ? ctx.today : start),
        }}
        prevHref={plannerHref(view, shiftPeriod(view, start, -1))}
        nextHref={plannerHref(view, next)}
        todayHref={plannerHref(view, ctx.today)}
      />
      <ContextChips data={data} />

      {view === "year" || !data.calendar ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="order-2 lg:order-1">
            <YearGrid data={data} today={ctx.today} />
          </div>
          <aside aria-label="Plan" className="order-1 lg:order-2">
            {focus}
          </aside>
        </div>
      ) : (
        <PlannerWorkspace
          view={view}
          start={start}
          today={ctx.today}
          timezone={ctx.timezone}
          weekStart={ctx.weekStart}
          blocks={data.calendar.blocks}
          deadlines={data.calendar.deadlines}
          unscheduled={data.calendar.unscheduled}
          openTasks={data.calendar.openTasks}
          reschedule={data.calendar.reschedule}
          priorityIds={data.items.flatMap((i) => (i.kind === "task" ? [i.task.id] : []))}
          focus={focus}
        />
      )}
    </>
  );
}
