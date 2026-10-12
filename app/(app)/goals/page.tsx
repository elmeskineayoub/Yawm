import type { Metadata } from "next";
import Link from "next/link";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalsTabs } from "@/components/goals/goals-tabs";
import { NewGoal } from "@/components/goals/new-goal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import type { GoalStatus } from "@/features/goals/logic";
import { loadGoalSummaries, type GoalSummary } from "@/features/goals/queries";
import { loadLookups } from "@/features/tasks/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Goals" };

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
  const areaName = (id: string | null) => lookups.areas.find((a) => a.id === id)?.name ?? null;

  const section = (title: string, list: GoalSummary[]) =>
    list.length > 0 && (
      <section aria-labelledby={`goals-${title}`}>
        <h2 id={`goals-${title}`} className="mb-2 text-sm font-semibold">
          {title} <span className="font-normal text-muted-foreground">{list.length}</span>
        </h2>
        <ul aria-label={`${title} goals`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              areaName={areaName(goal.area_id)}
              today={ctx.today}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <>
      <PageHeader
        title="Goals & Vision"
        description="Long-term outcomes, broken into milestones and connected to your work."
      />
      <GoalsTabs current="goals" />
      <div className="space-y-8">
        {archived ? (
          <>
            <p className="text-sm">
              <Link href="/goals" className="text-accent hover:underline">
                ← Back to goals
              </Link>
            </p>
            {goals.length === 0 ? (
              <EmptyState title="No archived goals" />
            ) : (
              section("Archived", goals)
            )}
          </>
        ) : (
          <>
            <NewGoal />
            {goals.length === 0 ? (
              <EmptyState title="No goals yet">
                Name an outcome you&apos;re working towards. Break it into milestones, link projects
                and tasks, and set it as one of this year&apos;s outcomes in the Planner.
              </EmptyState>
            ) : (
              <>
                {section(
                  "Active",
                  goals.filter((g) => g.status === "active"),
                )}
                {section(
                  "Paused",
                  goals.filter((g) => g.status === "paused"),
                )}
                {section(
                  "Achieved",
                  goals.filter((g) => g.status === "achieved"),
                )}
              </>
            )}
            <p className="text-sm">
              <Link href="/goals?status=archived" className="text-muted-foreground hover:underline">
                Archived goals
              </Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
