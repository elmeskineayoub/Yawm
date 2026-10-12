"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, toSaveState, type ActionResult, type SaveState } from "@/lib/action-result";
import { fieldErrorsOf, formObject, parseTagNames } from "@/lib/form";
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

export async function updateNote(
  noteId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  if (!uuid.safeParse(noteId).success) return { status: "error", message: "Unknown note." };
  const parsed = noteEditSchema.safeParse(
    formObject(formData, ["title", "body", "project_id", "goal_id", "task_id"]),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  const { supabase, workspace } = await getWorkspaceContext();
  const result = await updateNoteInWorkspace(
    supabase,
    workspace.id,
    noteId,
    parsed.data,
    parseTagNames(formData.get("tags")),
  );
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return toSaveState(ok());
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
