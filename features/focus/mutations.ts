import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db } from "@/lib/db/types";
import type { FocusSessionInput } from "./schemas";

// Focus sessions are logged with a client-supplied id, so re-logging the same finished session
// (after a reload or a retry) hits the primary key and is treated as success — never a duplicate.

const DUPLICATE = "23505";

export async function logFocusSessionInWorkspace(
  db: Db,
  workspaceId: string,
  session: FocusSessionInput,
): Promise<ActionResult<{ id: string }>> {
  const { error } = await db.from("focus_sessions").insert({
    id: session.id,
    workspace_id: workspaceId,
    task_id: session.task_id,
    session_type: session.session_type,
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_seconds: session.duration_seconds,
  });
  if (error && error.code !== DUPLICATE) {
    // A task from another workspace (or a deleted one) is rejected by the composite foreign key.
    if (error.code === "23503") return fail("That task is not in this workspace.");
    return fail("Could not save the focus session.");
  }
  return ok({ id: session.id });
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
