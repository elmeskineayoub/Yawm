import type { Metadata } from "next";
import Link from "next/link";
import { GoalRow } from "@/components/goals/goal-card";
import { GoalsTabs } from "@/components/goals/goals-tabs";
import { NewGoal } from "@/components/goals/new-goal";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import type { GoalStatus } from "@/features/goals/logic";
import { loadGoalSummaries, type GoalSummary } from "@/features/goals/queries";
import { loadLookups, type AreaLite } from "@/features/tasks/queries";
import { formatDate } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Goals" };

type Group = { key: string; area: AreaLite | null; goals: GoalSummary[] };

/** Groups goals by life area, in the areas' own order; goals without an area come last. */
function byArea(goals: GoalSummary[], areas: AreaLite[]): Group[] {
  const groups: Group[] = areas
    .map((area) => ({ key: area.id, area, goals: goals.filter((g) => g.area_id === area.id) }))
    .filter((g) => g.goals.length > 0);
  const known = new Set(areas.map((a) => a.id));
  const rest = goals.filter((g) => !g.area_id || !known.has(g.area_id));
  if (rest.length) groups.push({ key: "none", area: null, goals: rest });
  return groups;
}

function GoalList({ goals, label, today }: { goals: GoalSummary[]; label: string; today: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-border">
      {goals.map((goal) => (
        <GoalRow key={goal.id} goal={goal} today={today} />
      ))}
    </ul>
  );
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getWorkspaceContext();
  const archived = (await searchParams).status === "archived";
  const statuses: GoalStatus[] = archived ? ["archived"] : ["active", "paused", "achieved"];
  const [goals, lookups] = await Promise.all([
    loadGoalSummaries(ctx, { statuses }),
    loadLookups(ctx),
  ]);

  if (archived) {
    return (
      <>
        <PageHeader
          title="Archived goals"
          description="Kept for reference. Open one to change its status."
          breadcrumb={[{ label: "Goals & Vision", href: "/goals" }]}
        />
        {goals.length === 0 ? (
          <EmptyState title="No archived goals" />
        ) : (
          <div className="max-w-4xl">
            <GoalList goals={goals} label="Archived goals" today={ctx.today} />
          </div>
        )}
      </>
    );
  }

  const current = goals.filter((g) => g.status !== "achieved");
  const achieved = goals.filter((g) => g.status === "achieved");
  const active = current.filter((g) => g.status === "active");
  // The nearest dated next milestone across active goals: the one thing to look at first.
  const upcoming = active
    .flatMap((g) => (g.next?.due_date ? [{ goal: g, due: g.next.due_date }] : []))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const summary =
    goals.length === 0
      ? "Long-term outcomes, broken into milestones and connected to your work."
      : `${active.length} active goal${active.length === 1 ? "" : "s"}${
          upcoming
            ? `. Next milestone: ${upcoming.goal.next!.title}, ${
                upcoming.due < ctx.today ? "was due " : ""
              }${formatDate(upcoming.due, "short")}.`
            : "."
        }`;

  return (
    <>
      <PageHeader
        title="Goals & Vision"
        description={summary}
        actions={
          <>
            <Link
              href="/goals?status=archived"
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              Archived goals
            </Link>
            <NewGoal areas={lookups.areas} />
          </>
        }
      />
      <GoalsTabs current="goals" />
      {goals.length === 0 ? (
        <EmptyState title="No goals yet">
          <span className="block">
            Name an outcome you&apos;re working towards. Break it into milestones, link projects and
            tasks, and set it as one of this year&apos;s outcomes in the Planner.
          </span>
          <span className="mt-4 inline-block">
            <NewGoal areas={lookups.areas} variant="outline" />
          </span>
        </EmptyState>
      ) : (
        <div className="max-w-4xl space-y-6">
          {current.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Every goal here is achieved. Add the next one when you&apos;re ready.
            </p>
          )}
          {byArea(current, lookups.areas).map((group, index) => (
            <Section
              key={group.key}
              divider={index > 0}
              count={group.goals.length}
              title={
                <span className="inline-flex items-center gap-2">
                  {group.area && (
                    <span
                      aria-hidden
                      className="size-2 rounded-full ring-1 ring-foreground/20 ring-inset"
                      style={{ backgroundColor: group.area.color }}
                    />
                  )}
                  {group.area?.name ?? "No life area"}
                </span>
              }
            >
              <GoalList
                goals={group.goals}
                label={`${group.area?.name ?? "No life area"} goals`}
                today={ctx.today}
              />
            </Section>
          ))}
          {achieved.length > 0 && (
            <details className="group border-t border-border pt-6">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="text-muted-foreground transition-transform group-open:rotate-90"
                >
                  ›
                </span>
                Achieved
                <span className="font-normal text-muted-foreground tabular-nums">
                  {achieved.length}
                </span>
              </summary>
              <div className="mt-2">
                <GoalList goals={achieved} label="Achieved goals" today={ctx.today} />
              </div>
            </details>
          )}
        </div>
      )}
    </>
  );
}
