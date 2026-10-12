"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, toSaveState, type ActionResult, type SaveState } from "@/lib/action-result";
import { fieldErrorsOf, formObject } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { projectCreateSchema, projectEditSchema } from "./schemas";

const uuid = z.uuid();

function refresh() {
  revalidatePath("/", "layout");
}

export async function createProject(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = projectCreateSchema.safeParse(
    formObject(formData, ["name", "area_id", "status", "start_date", "due_date"]),
  );
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase, workspace } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("projects")
    .insert({ workspace_id: workspace.id, ...parsed.data })
    .select("id")
    .single();
  if (error) return fail("Could not create the project. Please try again.");
  refresh();
  return ok({ id: data.id });
}

export async function updateProject(
  projectId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  if (!uuid.safeParse(projectId).success) return { status: "error", message: "Unknown project." };
  const parsed = projectEditSchema.safeParse(
    formObject(formData, [
      "name",
      "description",
      "notes",
      "area_id",
      "status",
      "start_date",
      "due_date",
    ]),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", projectId)
    .select("id");
  if (error) return { status: "error", message: "Could not save the project. Please try again." };
  if (!data.length) return { status: "error", message: "This project no longer exists." };
  refresh();
  return toSaveState(ok());
}

/** Tasks are kept and become project-less (the foreign key sets them to null). */
export async function deleteProject(projectId: string): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success) return fail("Invalid request.");
  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase.from("projects").delete().eq("id", projectId).select("id");
  if (error) return fail("Could not delete the project.");
  if (!data.length) return fail("This project no longer exists.");
  refresh();
  return ok();
}
