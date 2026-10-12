import type { Metadata } from "next";
import Link from "next/link";
import { GoalsTabs } from "@/components/goals/goals-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { VisionBoard } from "@/components/vision/vision-board";
import { loadGoalOptions } from "@/features/goals/queries";
import { loadLookups } from "@/features/tasks/queries";
import { loadVisionCards } from "@/features/vision/queries";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Vision board" };

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

export default async function VisionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const area = params.area === "none" || isUuid(params.area) ? params.area : undefined;
  const goal = isUuid(params.goal) ? params.goal : undefined;
  const archived = params.archived === "1";
  const ctx = await getWorkspaceContext();
  const [cards, lookups, goals] = await Promise.all([
    loadVisionCards(ctx, { area, goal, archived }),
    loadLookups(ctx),
    loadGoalOptions(ctx),
  ]);
  const areas = lookups.areas.filter((a) => !a.archived_at);
  const goalName = goal ? goals.find((g) => g.id === goal)?.title : undefined;

  const href = (next: { area?: string; goal?: string; archived?: boolean }) => {
    const q = new URLSearchParams();
    if (next.area) q.set("area", next.area);
    if (next.goal) q.set("goal", next.goal);
    if (next.archived) q.set("archived", "1");
    const s = q.toString();
    return s ? `/goals/vision?${s}` : "/goals/vision";
  };
  const chip = (label: string, target: string | undefined) => (
    <Link
      key={label}
      href={href({ area: target, goal })}
      aria-current={area === target ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-xs",
        area === target
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Goals & Vision"
        description="Pictures and words that remind you where you're heading."
      />
      <GoalsTabs current="vision" />
      <div className="space-y-4">
        {!archived && (
          <nav aria-label="Filter by life area" className="flex flex-wrap gap-1.5">
            {chip("All", undefined)}
            {areas.map((a) => chip(a.name, a.id))}
            {chip("No area", "none")}
          </nav>
        )}
        {goalName && (
          <p className="text-sm">
            Showing cards for <span className="font-medium">{goalName}</span> ·{" "}
            <Link href={href({ area })} className="text-accent hover:underline">
              Show all goals
            </Link>
          </p>
        )}
        {archived && (
          <p className="text-sm">
            <Link href="/goals/vision" className="text-accent hover:underline">
              ← Back to the board
            </Link>
          </p>
        )}
        <VisionBoard
          cards={cards}
          areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          goals={goals.map((g) => ({ id: g.id, name: g.title }))}
          defaults={{
            area_id: area && area !== "none" ? area : null,
            goal_id: goal ?? null,
          }}
        />
        {!archived && (
          <p className="text-sm">
            <Link href={href({ archived: true })} className="text-muted-foreground hover:underline">
              Archived cards
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
