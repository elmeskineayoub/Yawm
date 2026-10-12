"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, toSaveState, type ActionResult, type SaveState } from "@/lib/action-result";
import { fieldErrorsOf, formObject, parseTagNames } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import {
  convertIdeaInWorkspace,
  deleteIdeaInWorkspace,
  setIdeaStatusInWorkspace,
  updateIdeaInWorkspace,
} from "./mutations";
import { ideaCaptureSchema, ideaEditSchema, ideaStatus } from "./schemas";

// Idea content is private: never log titles or bodies.

const uuid = z.uuid();

function refresh() {
  revalidatePath("/", "layout");
}

export async function createIdea(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = ideaCaptureSchema.safeParse(formObject(formData, ["title", "body"]));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const { supabase, workspace } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("ideas")
    .insert({ workspace_id: workspace.id, ...parsed.data })
    .select("id")
    .single();
  if (error) return fail("Could not save the idea. Please try again.");
  refresh();
  return ok({ id: data.id });
}

export async function updateIdea(
  ideaId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  if (!uuid.safeParse(ideaId).success) return { status: "error", message: "Unknown idea." };
  const parsed = ideaEditSchema.safeParse(formObject(formData, ["title", "body", "status"]));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  const { supabase, workspace } = await getWorkspaceContext();
  const result = await updateIdeaInWorkspace(
    supabase,
    workspace.id,
    ideaId,
    parsed.data,
    parseTagNames(formData.get("tags")),
  );
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return toSaveState(ok());
}

export async function setIdeaStatus(ideaId: string, status: string): Promise<ActionResult> {
  const parsed = ideaStatus.safeParse(status);
  if (!uuid.safeParse(ideaId).success || !parsed.success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await setIdeaStatusInWorkspace(supabase, workspace.id, ideaId, parsed.data);
  if (!result.ok) return result;
  refresh();
  return ok();
}

export async function deleteIdea(ideaId: string): Promise<ActionResult> {
  if (!uuid.safeParse(ideaId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await deleteIdeaInWorkspace(supabase, workspace.id, ideaId);
  if (!result.ok) return result;
  refresh();
  return ok();
}

/** Converts in one database transaction; converting again returns the same task/project. */
export async function convertIdea(
  ideaId: string,
  target: "task" | "project",
): Promise<ActionResult<{ href: string }>> {
  if (!uuid.safeParse(ideaId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await convertIdeaInWorkspace(supabase, workspace.id, ideaId, target);
  if (!result.ok) return result;
  refresh();
  return ok({ href: `/${target === "task" ? "tasks" : "projects"}/${result.data.id}` });
}
