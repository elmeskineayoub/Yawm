import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";
import type { FocusSessionInput } from "./schemas";

// Focus sessions are logged with a client-supplied id, so re-logging the same finished session
// (after a reload or a retry) hits the primary key and is treated as success — never a duplicate.

const DUPLICATE = "23505";

/** The column added by migration 20261107090000 is missing (not applied yet). */
function isMissingProjectColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST204" || error.code === "42703" || /project_id/.test(error.message ?? "")
  );
}

/**
 * Logs a finished session. `projectSaved` is false only when the session was saved without its
 * project because the project column does not exist yet (the migration has not been applied):
 * the time is kept, and the caller can say that project tracking needs the database update.
 */
export async function logFocusSessionInWorkspace(
  db: Db,
  workspaceId: string,
  session: FocusSessionInput,
): Promise<ActionResult<{ id: string; projectSaved: boolean }>> {
  const row: Tables["focus_sessions"]["Insert"] = {
    id: session.id,
    workspace_id: workspaceId,
    task_id: session.task_id,
    session_type: session.session_type,
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_seconds: session.duration_seconds,
  };
  let projectSaved = true;
  const withProject: Tables["focus_sessions"]["Insert"] = {
    ...row,
    project_id: session.project_id,
  };
  let { error } = await db.from("focus_sessions").insert(session.project_id ? withProject : row);
  if (error && session.project_id && isMissingProjectColumn(error)) {
    ({ error } = await db.from("focus_sessions").insert(row));
    projectSaved = false;
  }
  if (error && error.code !== DUPLICATE) {
    // A task or project from another workspace (or a deleted one) fails the composite foreign keys.
    if (error.code === "23503") return fail("That project or task is not in this workspace.");
    if (error.message?.includes("FOCUS_PROJECT_MISMATCH")) {
      return fail("That task belongs to a different project.");
    }
    return fail("Could not save the focus session.");
  }
  return ok({ id: session.id, projectSaved });
}

export async function deleteFocusSessionInWorkspace(
  db: Db,
  workspaceId: string,
  sessionId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("focus_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the session.");
  if (!data.length) return fail("This session no longer exists.");
  return ok();
}
