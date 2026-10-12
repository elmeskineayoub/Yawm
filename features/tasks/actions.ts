"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, toSaveState, type ActionResult, type SaveState } from "@/lib/action-result";
import { fieldErrorsOf, formObject, parseTagNames } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { friendlyTaskError } from "./logic";
import { quickTaskSchema, taskEditSchema, taskStatus } from "./schemas";

// Never log task titles or descriptions: they are private content.

const uuid = z.uuid();

function refresh() {
  revalidatePath("/", "layout");
}

export async function createTask(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = quickTaskSchema.safeParse(
    formObject(formData, ["title", "due_date", "priority", "project_id", "parent_task_id"]),
  );
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));

  const { supabase, workspace } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ workspace_id: workspace.id, ...parsed.data })
    .select("id")
    .single();
  if (error) return fail(friendlyTaskError(error.message));

  const planId = formData.get("plan_id");
  if (typeof planId === "string" && uuid.safeParse(planId).success) {
    const link = await supabase
      .from("plan_items")
      .insert({ workspace_id: workspace.id, plan_id: planId, task_id: data.id });
    if (link.error) return fail("The task was created but could not be added to the plan.");
  }

  refresh();
  return ok({ id: data.id });
}

export async function updateTask(
  taskId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  if (!uuid.safeParse(taskId).success) return { status: "error", message: "Unknown task." };
  const parsed = taskEditSchema.safeParse({
    ...formObject(formData, [
      "title",
      "description",
      "status",
      "priority",
      "due_date",
      "due_time",
      "estimate_minutes",
      "project_id",
      "area_id",
      "recurrence_frequency",
      "recurrence_interval",
      "recurrence_until",
    ]),
    recurrence_weekdays: formData.getAll("recurrence_weekdays"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("tasks")
    .update(parsed.data)
    .eq("id", taskId)
    .select("id");
  if (error) return { status: "error", message: friendlyTaskError(error.message) };
  if (!data.length) return { status: "error", message: "This task no longer exists." };

  const tags = await supabase.rpc("set_task_tags", {
    target_task_id: taskId,
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

export async function setTaskStatus(taskId: string, status: string): Promise<ActionResult> {
  const parsedStatus = taskStatus.safeParse(status);
  if (!uuid.safeParse(taskId).success || !parsedStatus.success) return fail("Invalid request.");

  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: parsedStatus.data })
    .eq("id", taskId)
    .select("id");
  if (error) return fail(friendlyTaskError(error.message));
  if (!data.length) return fail("This task no longer exists.");

  refresh();
  return ok();
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success) return fail("Invalid request.");
  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase.from("tasks").delete().eq("id", taskId).select("id");
  if (error) return fail("Could not delete the task. Please try again.");
  if (!data.length) return fail("This task no longer exists.");
  refresh();
  return ok();
}

export async function addDependency(taskId: string, dependsOnId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success || !uuid.safeParse(dependsOnId).success) {
    return fail("Choose a task.");
  }
  const { supabase, workspace } = await getWorkspaceContext();
  const { error } = await supabase.from("task_dependencies").insert({
    workspace_id: workspace.id,
    task_id: taskId,
    depends_on_task_id: dependsOnId,
  });
  if (error) {
    if (error.code === "23505") return fail("That dependency already exists.");
    if (error.code === "23514") return fail("A task cannot depend on itself.");
    return fail(friendlyTaskError(error.message));
  }
  refresh();
  return ok();
}

export async function removeDependency(taskId: string, dependsOnId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success || !uuid.safeParse(dependsOnId).success) {
    return fail("Invalid request.");
  }
  const { supabase } = await getWorkspaceContext();
  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("task_id", taskId)
    .eq("depends_on_task_id", dependsOnId);
  if (error) return fail("Could not remove the dependency.");
  refresh();
  return ok();
}
