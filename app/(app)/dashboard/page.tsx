import type { Metadata } from "next";
import { CustomizeDashboard } from "@/components/dashboard/customize-dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { JournalPromptCard } from "@/components/dashboard/journal-prompt-card";
import { dailyPrompt } from "@/features/dashboard/logic";
import { buildDashboardModel } from "@/features/dashboard/model";
import { loadDashboardInsights, loadDashboardPrefs } from "@/features/dashboard/queries";
import { loadFocusSummary, loadProjectFocusTotals } from "@/features/focus/queries";
import { loadGoalSummaries, loadMilestonesDue } from "@/features/goals/queries";
import { loadHabitsForDay } from "@/features/habits/queries";
import { countInbox } from "@/features/inbox/queries";
import { loadProjectSummaries } from "@/features/projects/queries";
import { loadLookups } from "@/features/tasks/queries";
import { loadToday } from "@/features/tasks/today";
import { addDays, formatDate, periodStart } from "@/lib/dates";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The Dashboard answers "what needs my attention, and what should I focus on next?". It is the
 * wide view: Today is where the day's work happens, so the Dashboard picks one next action, lists
 * only what needs attention, and summarises the day, the week, projects, and goals. Every figure is
 * derived from records in buildDashboardModel. Sections can be hidden (Customize).
 */
export default async function DashboardPage() {
  const ctx = await getWorkspaceContext();
  const prefs = await loadDashboardPrefs(ctx);
  const show = (key: Parameters<typeof prefs.hidden.has>[0]) => !prefs.hidden.has(key);
  const lookups = await loadLookups(ctx);
  const weekStartDate = periodStart("week", ctx.today, ctx.weekStart);
  const none = Promise.resolve(null);

  // One parallel batch; hidden sections skip their queries. Today's lists feed "Next up" and the
  // summary sentence, so they always load.
  const [day, inbox, projects, goals, habits, focus, insights, milestones, weekPlan] =
    await Promise.all([
      loadToday(ctx, lookups),
      countInbox(ctx),
      loadProjectSummaries(ctx, { statuses: ["active"] }),
      loadGoalSummaries(ctx, { statuses: ["active"] }),
      show("today") ? loadHabitsForDay(ctx, ctx.today) : none,
      show("today") || show("week") ? loadFocusSummary(ctx) : none,
      show("week") ? loadDashboardInsights(ctx) : none,
      show("attention")
        ? loadMilestonesDue(ctx, { from: ctx.today, to: addDays(ctx.today, 8) })
        : none,
      show("week")
        ? ctx.supabase
            .from("plans")
            .select("theme")
            .eq("workspace_id", ctx.workspace.id)
            .eq("period", "week")
            .eq("period_start", weekStartDate)
            .maybeSingle()
        : none,
    ]);
  // Best effort: without the project column (migration 20261107090000) rows just show no time.
  const projectFocus = show("progress")
    ? await loadProjectFocusTotals(
        ctx,
        projects.map((p) => p.id),
      )
    : { available: false, totals: {} };

  const model = buildDashboardModel({
    today: ctx.today,
    timezone: ctx.timezone,
    // A server component renders once per request; "now" is that request's moment (as on Today).
    now: new Date().getTime(),
    day,
    inbox,
    areas: lookups.areas,
    projects,
    projectFocus: projectFocus.totals,
    goals,
    habits,
    focus,
    insights,
    milestones,
    weekTheme: weekPlan?.data?.theme ?? null,
  });

  return (
    <DashboardView
      model={model}
      today={ctx.today}
      timezone={ctx.timezone}
      dateLabel={formatDate(ctx.today)}
      hidden={prefs.hidden}
      customize={<CustomizeDashboard hidden={[...prefs.hidden]} available={prefs.available} />}
      reflect={
        <JournalPromptCard prompt={dailyPrompt(ctx.today)} today={ctx.today} variant="secondary" />
      }
    />
  );
}
