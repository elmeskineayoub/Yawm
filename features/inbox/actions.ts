"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, toSaveState, type ActionResult, type SaveState } from "@/lib/action-result";
import { fieldErrorsOf, formObject, parseTagNames } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
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

  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("ideas")
    .update(parsed.data)
    .eq("id", ideaId)
    .select("id");
  if (error) return { status: "error", message: "Could not save the idea. Please try again." };
  if (!data.length) return { status: "error", message: "This idea no longer exists." };

  const tags = await supabase.rpc("set_idea_tags", {
    target_idea_id: ideaId,
    tag_names: parseTagNames(formData.get("tags")),
  });
  if (tags.error) {
    return {
      status: "error",
      message: tags.error.message.includes("TOO_MANY_TAGS")
        ? "Use at most 20 tags."
        : "Details saved, but the tags could not be updated.",
    };
  }
  refresh();
  return toSaveState(ok());
}

export async function setIdeaStatus(ideaId: string, status: string): Promise<ActionResult> {
  const parsed = ideaStatus.safeParse(status);
  if (!uuid.safeParse(ideaId).success || !parsed.success) return fail("Invalid request.");
  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("ideas")
    .update({ status: parsed.data })
    .eq("id", ideaId)
    .select("id");
  if (error) return fail("Could not update the idea.");
  if (!data.length) return fail("This idea no longer exists.");
  refresh();
  return ok();
}

export async function deleteIdea(ideaId: string): Promise<ActionResult> {
  if (!uuid.safeParse(ideaId).success) return fail("Invalid request.");
  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase.from("ideas").delete().eq("id", ideaId).select("id");
  if (error) return fail("Could not delete the idea.");
  if (!data.length) return fail("This idea no longer exists.");
  refresh();
  return ok();
}

/** Converts in one database transaction; converting again returns the same task/project. */
export async function convertIdea(
  ideaId: string,
  target: "task" | "project",
): Promise<ActionResult<{ href: string }>> {
  if (!uuid.safeParse(ideaId).success) return fail("Invalid request.");
  const { supabase } = await getWorkspaceContext();
  const { data, error } =
    target === "task"
      ? await supabase.rpc("convert_idea_to_task", { idea_id: ideaId })
      : await supabase.rpc("convert_idea_to_project", { idea_id: ideaId });
  if (error || !data) return fail(`Could not convert the idea into a ${target}.`);
  refresh();
  return ok({ href: target === "task" ? `/tasks/${data}` : `/projects/${data}` });
}
