"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, formObject } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import {
  createNoteInWorkspace,
  deleteNoteInWorkspace,
  setNoteArchivedInWorkspace,
  updateNoteInWorkspace,
} from "./mutations";
import { noteCaptureSchema, noteEditSchema } from "./schemas";

// Note content is private: never log titles or bodies, never send them to third parties.

const uuid = z.uuid();

function refresh() {
  revalidatePath("/", "layout");
}

export async function createNote(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = noteCaptureSchema.safeParse(formObject(formData, ["title", "body"]));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const { supabase, workspace } = await getWorkspaceContext();
  const result = await createNoteInWorkspace(supabase, workspace.id, parsed.data);
  if (!result.ok) return result;
  refresh();
  return ok({ id: result.data.id });
}

/**
 * Autosave from the note editor: title, body, links, and tags in one call. Same validation and
 * workspace checks as the form save.
 */
export async function saveNote(
  noteId: string,
  input: unknown,
  tags: string[],
): Promise<ActionResult> {
  if (!uuid.safeParse(noteId).success) return fail("Unknown note.");
  const parsed = noteEditSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrorsOf(parsed.error);
    return fail(errors.title?.[0] ?? errors.body?.[0] ?? "Check the note.", errors);
  }
  const tagNames = z.array(z.string().trim().min(1).max(40)).max(30).safeParse(tags);
  if (!tagNames.success) return fail("Tags can be up to 40 characters (30 tags at most).");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await updateNoteInWorkspace(
    supabase,
    workspace.id,
    noteId,
    parsed.data,
    tagNames.data,
  );
  if (!result.ok) return result;
  refresh();
  return ok();
}

export async function setNoteArchived(noteId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(noteId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await setNoteArchivedInWorkspace(supabase, workspace.id, noteId, archived);
  if (!result.ok) return result;
  refresh();
  return ok();
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  if (!uuid.safeParse(noteId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await deleteNoteInWorkspace(supabase, workspace.id, noteId);
  if (!result.ok) return result;
  refresh();
  return ok();
}
