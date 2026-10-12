import { loadBlocks, type CalendarBlock } from "@/features/calendar/queries";
import { loadPlanPage } from "@/features/planning/queries";
import { zonedDayRange } from "@/lib/dates/zoned";
import { addDays, dateOfInstant, periodStart, type IsoDate } from "@/lib/dates";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { compareTasks } from "./logic";
import { enrichTasks, loadDueTasks, TASK_COLUMNS, type Lookups, type TaskView } from "./queries";

export type TodayData = {
  priorities: Awaited<ReturnType<typeof loadPlanPage>>["items"];
  /** Time blocks overlapping today, in the user's timezone. */
  scheduled: CalendarBlock[];
  dayPlanId: string | null;
  overdue: TaskView[];
  dueToday: TaskView[];
  upcoming: TaskView[];
  completedToday: TaskView[];
  completedThisWeek: number;
  weekStartDate: IsoDate;
};

/** Everything "what matters now" needs, interpreted in the user's timezone. */
export async function loadToday(ctx: WorkspaceContext, lookups: Lookups): Promise<TodayData> {
  const { supabase, workspace, today, timezone, weekStart } = ctx;
  const weekStartDate = periodStart("week", today, weekStart);
  // Fetch a little extra and filter by the user's local date, so timezone offsets never drop
  // a completion that happened "today" locally.
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString();

  const [dayPlan, due, completedRows, scheduled] = await Promise.all([
    loadPlanPage(ctx, "day", today, "week", lookups),
    loadDueTasks(ctx, lookups, { from: today, to: addDays(today, 8), includeOverdue: true }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("workspace_id", workspace.id)
      .eq("status", "done")
      .gte("completed_at", since)
      .limit(1000),
    loadBlocks(ctx, zonedDayRange(today, timezone)),
  ]);
  if (completedRows.error) throw new Error("Could not load completed tasks.");

  const completed = completedRows.data.filter(
    (t) => t.completed_at && dateOfInstant(t.completed_at, timezone) >= weekStartDate,
  );
  const completedToday = await enrichTasks(
    ctx,
    completed.filter((t) => dateOfInstant(t.completed_at!, timezone) === today),
    lookups,
  );

  return {
    priorities: dayPlan.items,
    scheduled,
    dayPlanId: dayPlan.plan?.id ?? null,
    overdue: due.filter((t) => t.due_date! < today),
    dueToday: due.filter((t) => t.due_date === today),
    upcoming: due.filter((t) => t.due_date! > today),
    completedToday: completedToday.sort(compareTasks("title")),
    completedThisWeek: completed.length,
    weekStartDate,
  };
}
