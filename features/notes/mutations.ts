import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";

// ID-based note writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning). Links are composite foreign keys, so a project,
// goal, or task from another workspace is rejected by the database as well.

const NOT_FOUND = "This note no longer exists.";

export async function createNoteInWorkspace(
  db: Db,
  workspaceId: string,
  fields: { title: string; body: string | null },
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await db
    .from("notes")
    .insert({ workspace_id: workspaceId, ...fields })
    .select("id")
    .single();
  if (error) return fail("Could not save the note. Please try again.");
  return ok({ id: data.id });
}

export async function updateNoteInWorkspace(
  db: Db,
  workspaceId: string,
  noteId: string,
  fields: Tables["notes"]["Update"],
  tagNames: string[],
): Promise<ActionResult> {
  const { data, error } = await db
    .from("notes")
    .update(fields)
    .eq("id", noteId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) {
    if (error.code === "23503") return fail("Link only to work in this workspace.");
    return fail("Could not save the note. Please try again.");
  }
  if (!data.length) return fail(NOT_FOUND);

  const tags = await db.rpc("set_note_tags", { target_note_id: noteId, tag_names: tagNames });
  if (tags.error) {
    return fail(
      tags.error.message.includes("TOO_MANY_TAGS")
        ? "Use at most 20 tags."
        : "Details saved, but the tags could not be updated.",
    );
  }
  return ok();
}

export async function setNoteArchivedInWorkspace(
  db: Db,
  workspaceId: string,
  noteId: string,
  archived: boolean,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("notes")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", noteId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not update the note.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

export async function deleteNoteInWorkspace(
  db: Db,
  workspaceId: string,
  noteId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the note.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}
