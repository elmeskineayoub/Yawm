import type { Metadata } from "next";
import { FocusHistory } from "@/components/focus/focus-history";
import { FocusTimer } from "@/components/focus/focus-timer";
import { PageHeader } from "@/components/layout/page-header";
import { formatDuration } from "@/features/focus/logic";
import { loadFocusSummary } from "@/features/focus/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Focus" };

export default async function FocusPage() {
  const ctx = await getWorkspaceContext();
  const [summary, tasks] = await Promise.all([
    loadFocusSummary(ctx),
    ctx.supabase
      .from("tasks")
      .select("id, title")
      .eq("workspace_id", ctx.workspace.id)
      .in("status", ["todo", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (tasks.error) throw new Error("Could not load tasks.");

  return (
    <>
      <PageHeader
        title="Focus"
        description="A Pomodoro timer that survives a reload. Completed sessions are saved here."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <FocusTimer tasks={tasks.data} />

        <div className="space-y-6">
          <section
            aria-label="Focus totals"
            className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-surface p-5"
          >
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {formatDuration(summary.todaySeconds)}
              </p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary.todayCount}</p>
              <p className="text-xs text-muted-foreground">Sessions today</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {formatDuration(summary.weekSeconds)}
              </p>
              <p className="text-xs text-muted-foreground">This week</p>
            </div>
          </section>

          <section
            aria-labelledby="focus-history-heading"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 id="focus-history-heading" className="mb-2 text-sm font-semibold">
              Recent sessions
            </h2>
            <FocusHistory sessions={summary.recent} timezone={ctx.timezone} />
          </section>
        </div>
      </div>
    </>
  );
}
