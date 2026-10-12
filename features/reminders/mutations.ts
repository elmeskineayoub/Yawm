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
  const { error } = await db.from("reminder_preferences").upsert(
    {
      workspace_id: workspaceId,
      show_tasks: prefs.task,
      show_habits: prefs.habit,
      show_time_blocks: prefs.time_block,
    },
    { onConflict: "workspace_id" },
  );
  if (error) return fail("Could not save reminder settings.");
  return ok();
}
