import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";

// ID-based journal writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning). Journal text is private and never logged.

const NOT_FOUND = "This journal entry no longer exists.";

export async function createEntryInWorkspace(
  db: Db,
  workspaceId: string,
  fields: { entry_date: string; prompt: string | null; body: string | null },
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await db
    .from("journal_entries")
    .insert({ workspace_id: workspaceId, ...fields })
    .select("id")
    .single();
  if (error) return fail("Could not create the entry. Please try again.");
  return ok({ id: data.id });
}

export async function updateEntryInWorkspace(
  db: Db,
  workspaceId: string,
  entryId: string,
  fields: Tables["journal_entries"]["Update"],
  tagNames: string[],
): Promise<ActionResult> {
  const { data, error } = await db
    .from("journal_entries")
    .update(fields)
    .eq("id", entryId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not save the entry. Please try again.");
  if (!data.length) return fail(NOT_FOUND);

  const tags = await db.rpc("set_journal_tags", { target_entry_id: entryId, tag_names: tagNames });
  if (tags.error) {
    return fail(
      tags.error.message.includes("TOO_MANY_TAGS")
        ? "Use at most 20 tags."
        : "Entry saved, but the tags could not be updated.",
    );
  }
  return ok();
}

export async function deleteEntryInWorkspace(
  db: Db,
  workspaceId: string,
  entryId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("journal_entries")
    .delete()
    .eq("id", entryId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the entry.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}
