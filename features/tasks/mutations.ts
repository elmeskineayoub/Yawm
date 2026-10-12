import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";
import { friendlyTaskError, type TaskStatus } from "./logic";

/*
 * Task writes addressed by an ID the client supplied. Every one is scoped to the active workspace
 * resolved on the server, in addition to RLS: a member of several workspaces must not be able to
 * change another workspace's rows from this one by passing their IDs. A row outside the active
 * workspace behaves exactly like a row that does not exist.
 *
 * Inserts need no extra check: they always write the active workspace_id, and the composite
 * (id, workspace_id) foreign keys reject references to rows in any other workspace.
 */

const NOT_FOUND = "This task no longer exists.";

export async function updateTaskInWorkspace(
  db: Db,
  workspaceId: string,
  taskId: string,
  fields: Tables["tasks"]["Update"],
  tagNames: string[],
): Promise<ActionResult> {
  const { data, error } = await db
    .from("tasks")
    .update(fields)
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail(friendlyTaskError(error.message));
  if (!data.length) return fail(NOT_FOUND);

  // Only reached for a task confirmed to be in the active workspace.
  const tags = await db.rpc("set_task_tags", { target_task_id: taskId, tag_names: tagNames });
  if (tags.error) {
    return fail(
      tags.error.message.includes("TOO_MANY_TAGS")
        ? "Use at most 20 tags."
        : "Details saved, but the tags could not be updated.",
    );
  }
  return ok();
}

export async function setTaskStatusInWorkspace(
  db: Db,
  workspaceId: string,
  taskId: string,
  status: TaskStatus,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("tasks")
    .update({ status })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail(friendlyTaskError(error.message));
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

export async function deleteTaskInWorkspace(
  db: Db,
  workspaceId: string,
  taskId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the task. Please try again.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

export async function addDependencyInWorkspace(
  db: Db,
  workspaceId: string,
  taskId: string,
  dependsOnId: string,
): Promise<ActionResult> {
  const { error } = await db.from("task_dependencies").insert({
    workspace_id: workspaceId,
    task_id: taskId,
    depends_on_task_id: dependsOnId,
  });
  if (error) {
    if (error.code === "23505") return fail("That dependency already exists.");
    if (error.code === "23514") return fail("A task cannot depend on itself.");
    // Either task is outside the active workspace (composite foreign key).
    if (error.code === "23503") return fail(NOT_FOUND);
    return fail(friendlyTaskError(error.message));
  }
  return ok();
}

export async function removeDependencyInWorkspace(
  db: Db,
  workspaceId: string,
  taskId: string,
  dependsOnId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("task_dependencies")
    .delete()
    .eq("task_id", taskId)
    .eq("depends_on_task_id", dependsOnId)
    .eq("workspace_id", workspaceId)
    .select("task_id");
  if (error) return fail("Could not remove the dependency.");
  if (!data.length) return fail("That dependency no longer exists.");
  return ok();
}
