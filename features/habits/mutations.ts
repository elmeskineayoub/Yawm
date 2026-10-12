import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { IsoDate } from "@/lib/dates";
import type { Db, Tables } from "@/lib/db/types";
import type { HabitInput, LogEntry } from "./schemas";

// ID-based habit writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning). Habit and log content is never logged.

const NOT_FOUND = "This habit no longer exists.";

export async function createHabitInWorkspace(
  db: Db,
  workspaceId: string,
  input: HabitInput,
): Promise<ActionResult<{ id: string }>> {
  const { data: last } = await db
    .from("habits")
    .select("sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("habits")
    .insert({ ...input, workspace_id: workspaceId, sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return fail("Could not add the habit. Please try again.");
  return ok({ id: data.id });
}

export async function updateHabitInWorkspace(
  db: Db,
  workspaceId: string,
  habitId: string,
  fields: Tables["habits"]["Update"],
): Promise<ActionResult> {
  const { data, error } = await db
    .from("habits")
    .update(fields)
    .eq("id", habitId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not save the habit. Please try again.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

export async function deleteHabitInWorkspace(
  db: Db,
  workspaceId: string,
  habitId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the habit.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

/**
 * Records one day for a habit: an amount (1 for "done"), a rest day, or nothing. One log per
 * habit per day, so repeating the same call is harmless. Future days are refused: a habit can
 * only be completed once its day has come.
 */
export async function setHabitLogInWorkspace(
  db: Db,
  workspaceId: string,
  habitId: string,
  date: IsoDate,
  entry: LogEntry,
  today: IsoDate,
): Promise<ActionResult> {
  if (date > today && entry.type !== "clear") {
    return fail("You can only record today or earlier.");
  }
  const { data: habit } = await db
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!habit) return fail(NOT_FOUND);

  if (entry.type === "clear") {
    const { error } = await db
      .from("habit_logs")
      .delete()
      .eq("habit_id", habitId)
      .eq("workspace_id", workspaceId)
      .eq("log_date", date);
    return error ? fail("Could not update the habit. Please try again.") : ok();
  }
  const fields = {
    value: entry.type === "value" ? entry.value : null,
    rest: entry.type === "rest",
  };
  // Update the day's log if there is one, otherwise insert it. (An upsert would also try to
  // rewrite workspace_id/habit_id/log_date, which clients may not update.)
  const update = () =>
    db
      .from("habit_logs")
      .update(fields)
      .eq("habit_id", habitId)
      .eq("workspace_id", workspaceId)
      .eq("log_date", date)
      .select("id");
  const updated = await update();
  if (updated.error) return fail("Could not update the habit. Please try again.");
  if (updated.data.length) return ok();
  const inserted = await db
    .from("habit_logs")
    .insert({ workspace_id: workspaceId, habit_id: habitId, log_date: date, ...fields });
  if (!inserted.error) return ok();
  // 23505: another request logged the same day a moment ago; apply this change on top.
  if (inserted.error.code === "23505" && !(await update()).error) return ok();
  return fail("Could not update the habit. Please try again.");
}
