import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";
import type { IdeaStatus } from "./schemas";

// ID-based idea writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning).

const NOT_FOUND = "This idea no longer exists.";

export async function updateIdeaInWorkspace(
  db: Db,
  workspaceId: string,
  ideaId: string,
  fields: Tables["ideas"]["Update"],
  tagNames: string[],
): Promise<ActionResult> {
  const { data, error } = await db
    .from("ideas")
    .update(fields)
    .eq("id", ideaId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not save the idea. Please try again.");
  if (!data.length) return fail(NOT_FOUND);

  const tags = await db.rpc("set_idea_tags", { target_idea_id: ideaId, tag_names: tagNames });
  if (tags.error) {
    return fail(
      tags.error.message.includes("TOO_MANY_TAGS")
        ? "Use at most 20 tags."
        : "Details saved, but the tags could not be updated.",
    );
  }
  return ok();
}

export async function setIdeaStatusInWorkspace(
  db: Db,
  workspaceId: string,
  ideaId: string,
  status: IdeaStatus,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("ideas")
    .update({ status })
    .eq("id", ideaId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not update the idea.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

export async function deleteIdeaInWorkspace(
  db: Db,
  workspaceId: string,
  ideaId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("ideas")
    .delete()
    .eq("id", ideaId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the idea.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

/**
 * The conversion functions act on the idea's own workspace, so the idea is first confirmed to be
 * in the active workspace. (workspace_id can never change, so the check cannot go stale.)
 */
export async function convertIdeaInWorkspace(
  db: Db,
  workspaceId: string,
  ideaId: string,
  target: "task" | "project" | "goal",
): Promise<ActionResult<{ id: string }>> {
  const { data: idea, error: lookupError } = await db
    .from("ideas")
    .select("id")
    .eq("id", ideaId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (lookupError) return fail(`Could not convert the idea into a ${target}.`);
  if (!idea) return fail(NOT_FOUND);

  const { data, error } =
    target === "task"
      ? await db.rpc("convert_idea_to_task", { idea_id: ideaId })
      : target === "goal"
        ? await db.rpc("convert_idea_to_goal", { idea_id: ideaId })
        : await db.rpc("convert_idea_to_project", { idea_id: ideaId });
  if (error || !data) return fail(`Could not convert the idea into a ${target}.`);
  return ok({ id: data });
}
