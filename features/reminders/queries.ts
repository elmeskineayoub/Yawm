import { loadBlocks } from "@/features/calendar/queries";
import { loadHabitsDueToday } from "@/features/habits/queries";
import { zonedDayRange } from "@/lib/dates/zoned";
import { instantToLocal } from "@/lib/dates/zoned";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { buildReminders, DEFAULT_REMINDER_PREFS, type Reminder, type ReminderPrefs } from "./logic";

export async function loadReminderPreferences(ctx: WorkspaceContext): Promise<ReminderPrefs> {
  const { data, error } = await ctx.supabase
    .from("reminder_preferences")
    .select("show_tasks, show_habits, show_time_blocks")
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  if (error) throw new Error("Could not load reminder settings.");
  if (!data) return DEFAULT_REMINDER_PREFS;
  return { task: data.show_tasks, habit: data.show_habits, time_block: data.show_time_blocks };
}

/** The reminders to show right now, derived from due tasks, habits due today, and upcoming blocks. */
export async function loadReminders(ctx: WorkspaceContext): Promise<Reminder[]> {
  const { supabase, workspace, today, timezone } = ctx;
  const nowInstant = new Date().toISOString();

  const [prefs, dueTasks, habits, blocks, dismissed] = await Promise.all([
    loadReminderPreferences(ctx),
    supabase
      .from("tasks")
      .select("id, title, due_date")
      .eq("workspace_id", workspace.id)
      .in("status", ["todo", "in_progress"])
      .not("due_date", "is", null)
      .lte("due_date", today)
      .order("due_date")
      .limit(50),
    loadHabitsDueToday(ctx),
    loadBlocks(ctx, zonedDayRange(today, timezone)),
    supabase
      .from("reminder_dismissals")
      .select("reminder_key")
      .eq("workspace_id", workspace.id)
      .limit(2000),
  ]);
  if (dueTasks.error || dismissed.error) throw new Error("Could not load reminders.");

  const overdueTasks = dueTasks.data
    .filter((t) => t.due_date! < today)
    .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date! }));
  const dueTodayTasks = dueTasks.data
    .filter((t) => t.due_date === today)
    .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date! }));

  // Already filtered to "due today and not done" by loadHabitsDueToday.
  const habitReminders = habits;

  const blockReminders = blocks
    .filter((b) => b.starts_at > nowInstant)
    .map((b) => ({ id: b.id, title: b.title, time: instantToLocal(b.starts_at, timezone).time }));

  return buildReminders({
    today,
    overdueTasks,
    dueTodayTasks,
    habits: habitReminders,
    blocks: blockReminders,
    dismissed: new Set(dismissed.data.map((d) => d.reminder_key)),
    prefs,
  });
}
