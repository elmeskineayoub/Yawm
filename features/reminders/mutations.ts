import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db } from "@/lib/db/types";
import type { ReminderPrefs } from "./logic";

const DUPLICATE = "23505";

/** Dismisses a reminder by its stable key. Dismissing the same key twice is a no-op. */
export async function dismissReminderInWorkspace(
  db: Db,
  workspaceId: string,
  key: string,
): Promise<ActionResult> {
  const { error } = await db
    .from("reminder_dismissals")
    .insert({ workspace_id: workspaceId, reminder_key: key });
  if (error && error.code !== DUPLICATE) return fail("Could not dismiss the reminder.");
  return ok();
}

export async function setReminderPreferencesInWorkspace(
  db: Db,
  workspaceId: string,
  prefs: ReminderPrefs,
): Promise<ActionResult> {
  // Update-then-insert rather than upsert: a PostgREST upsert's ON CONFLICT DO UPDATE would try to
  // write workspace_id, which has no update grant (it must never change). This keeps writes within
  // the granted columns.
  const fields = {
    show_tasks: prefs.task,
    show_habits: prefs.habit,
    show_time_blocks: prefs.time_block,
  };
  const updated = await db
    .from("reminder_preferences")
    .update(fields)
    .eq("workspace_id", workspaceId)
    .select("workspace_id");
  if (updated.error) return fail("Could not save reminder settings.");
  if (updated.data.length) return ok();

  const inserted = await db
    .from("reminder_preferences")
    .insert({ workspace_id: workspaceId, ...fields });
  // A concurrent insert may have created the row first; that is fine.
  if (inserted.error && inserted.error.code !== "23505") {
    return fail("Could not save reminder settings.");
  }
  return ok();
}
