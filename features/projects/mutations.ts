import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";

// ID-based project writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning).

const NOT_FOUND = "This project no longer exists.";

export async function updateProjectInWorkspace(
  db: Db,
  workspaceId: string,
  projectId: string,
  fields: Tables["projects"]["Update"],
): Promise<ActionResult> {
  const { data, error } = await db
    .from("projects")
    .update(fields)
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not save the project. Please try again.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

export async function deleteProjectInWorkspace(
  db: Db,
  workspaceId: string,
  projectId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the project.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}
