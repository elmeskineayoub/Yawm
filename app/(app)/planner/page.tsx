import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { LinkWorkForm, UnlinkButton } from "@/components/planner/plan-links";
import { PlanForm } from "@/components/planner/plan-form";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskList, TaskRow } from "@/components/tasks/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { loadPlanPage } from "@/features/planning/queries";
import { loadLookups } from "@/features/tasks/queries";
import {
  formatDate,
  formatPeriod,
  isIsoDate,
  PARENT_PERIOD,
  periodEnd,
  periodStart,
  shiftPeriod,
  type PlanPeriod,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Planner" };

const PERIODS: { value: PlanPeriod; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

const href = (period: PlanPeriod, date: string) => `/planner?period=${period}&date=${date}`;

function childLabel(period: PlanPeriod, start: string) {
  if (period === "month") return formatPeriod("month", start).split(" ")[0];
  if (period === "week") return `Week of ${formatDate(start, "short")}`;
  return formatDate(start);
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ctx = await getWorkspaceContext();
  const rawPeriod = typeof params.period === "string" ? params.period : "week";
  const period: PlanPeriod = PERIODS.some((p) => p.value === rawPeriod)
    ? (rawPeriod as PlanPeriod)
    : "week";
  const date = typeof params.date === "string" && isIsoDate(params.date) ? params.date : ctx.today;
  const start = periodStart(period, date, ctx.weekStart);
  const end = periodEnd(period, start);
  const isCurrent = ctx.today >= start && ctx.today < end;

  const lookups = await loadLookups(ctx);
  const data = await loadPlanPage(ctx, period, start, PARENT_PERIOD[period], lookups);

  const linkedTaskIds = new Set(data.items.flatMap((i) => (i.kind === "task" ? [i.task.id] : [])));
  const linkedProjectIds = new Set(
    data.items.flatMap((i) => (i.kind === "project" ? [i.project.id] : [])),
  );
  const { data: openTasks } = await ctx.supabase
    .from("tasks")
    .select("id, title")
    .eq("workspace_id", ctx.workspace.id)
    .in("status", ["todo", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <>
      <PageHeader title="Planner" description="Connect yearly direction to daily action." />

      <nav
        aria-label="Planning period"
        className="mb-4 flex flex-wrap gap-1 border-b border-border"
      >
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={href(p.value, date)}
            aria-current={p.value === period ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              p.value === period
                ? "border-accent font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{formatPeriod(period, start)}</h2>
          {data.parent && (
            <p className="text-sm text-muted-foreground">
              Part of{" "}
              <Link
                href={href(data.parent.period, data.parent.start)}
                className="text-accent hover:underline"
              >
                {formatPeriod(data.parent.period, data.parent.start)}
              </Link>
              {!data.parent.exists && " (no plan yet)"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={href(period, shiftPeriod(period, start, -1))}
            aria-label={`Previous ${period}`}
            className="rounded-md border border-border p-2 hover:bg-surface-muted"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <Link
            href={href(period, ctx.today)}
            aria-disabled={isCurrent || undefined}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-muted",
              isCurrent && "pointer-events-none opacity-50",
            )}
          >
            Current
          </Link>
          <Link
            href={href(period, shiftPeriod(period, start, 1))}
            aria-label={`Next ${period}`}
            className="rounded-md border border-border p-2 hover:bg-surface-muted"
          >
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Plan notes" className="rounded-lg border border-border bg-surface p-5">
          <PlanForm period={period} start={start} plan={data.plan} />
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="linked-heading"
            className="space-y-3 rounded-lg border border-border bg-surface p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 id="linked-heading" className="text-sm font-semibold">
                {period === "day" ? "Priorities" : "Linked work"}
              </h3>
              {data.progress.total > 0 && (
                <div className="w-40">
                  <ProgressBar progress={data.progress} label="Plan progress" />
                </div>
              )}
            </div>
            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing linked yet. Link the projects and tasks this {period} is about.
              </p>
            ) : (
              <ul aria-label="Linked work">
                {data.items.map((item) =>
                  item.kind === "task" ? (
                    <TaskRow
                      key={item.id}
                      task={item.task}
                      today={ctx.today}
                      actions={<UnlinkButton itemId={item.id} label={item.task.title} />}
                    />
                  ) : (
                    <li
                      key={item.id}
                      className="flex items-start gap-2 border-b border-border py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/projects/${item.project.id}`}
                          className="text-sm font-medium break-words hover:underline"
                        >
                          {item.project.name}
                        </Link>
                        <div className="mt-1 max-w-xs">
                          <ProgressBar
                            progress={item.project.progress}
                            label={`${item.project.name} progress`}
                          />
                        </div>
                      </div>
                      <UnlinkButton itemId={item.id} label={item.project.name} />
                    </li>
                  ),
                )}
              </ul>
            )}
            <LinkWorkForm
              period={period}
              start={start}
              tasks={(openTasks ?? [])
                .filter((t) => !linkedTaskIds.has(t.id))
                .map((t) => ({ id: t.id, label: t.title }))}
              projects={lookups.projects
                .filter(
                  (p) =>
                    !linkedProjectIds.has(p.id) &&
                    p.status !== "archived" &&
                    p.status !== "completed",
                )
                .map((p) => ({ id: p.id, label: p.name }))}
            />
            {data.plan && (
              <QuickAddTask
                planId={data.plan.id}
                placeholder="Add a new task to this plan"
                defaultDueDate={period === "day" ? start : undefined}
                compact
              />
            )}
          </section>

          {data.children.length > 0 && (
            <section
              aria-labelledby="children-heading"
              className="rounded-lg border border-border bg-surface p-5"
            >
              <h3 id="children-heading" className="mb-2 text-sm font-semibold">
                Inside this {period}
              </h3>
              <ul className="divide-y divide-border">
                {data.children.map((child) => (
                  <li
                    key={child.start}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <Link href={href(child.period, child.start)} className="hover:underline">
                      {childLabel(child.period, child.start)}
                    </Link>
                    <span className="min-w-0 truncate text-right text-xs text-muted-foreground">
                      {child.plan
                        ? [child.plan.theme, child.itemCount ? `${child.itemCount} linked` : null]
                            .filter(Boolean)
                            .join(" · ") || "Planned"
                        : "No plan"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section aria-labelledby="due-heading" className="mt-6">
        <h3 id="due-heading" className="mb-2 text-sm font-semibold">
          Due this {period}
        </h3>
        {data.dueInPeriod.length === 0 ? (
          <EmptyState title="No deadlines in this period" />
        ) : (
          <TaskList tasks={data.dueInPeriod} today={ctx.today} label={`Due this ${period}`} />
        )}
      </section>
    </>
  );
}
