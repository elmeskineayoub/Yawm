"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, toSaveState, type ActionResult, type SaveState } from "@/lib/action-result";
import { isIsoDate } from "@/lib/dates";
import { fieldErrorsOf, formObject, parseTagNames } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { friendlyTaskError } from "./logic";
import {
  addDependencyInWorkspace,
  deleteTaskInWorkspace,
  removeDependencyInWorkspace,
  setTaskDueDateInWorkspace,
  setTaskStatusInWorkspace,
  updateTaskInWorkspace,
} from "./mutations";
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

  const { supabase, workspace } = await getWorkspaceContext();
  const result = await updateTaskInWorkspace(
    supabase,
    workspace.id,
    taskId,
    parsed.data,
    parseTagNames(formData.get("tags")),
  );
  if (!result.ok) return { status: "error", message: result.error };

  refresh();
  return toSaveState(ok());
}

export async function setTaskStatus(taskId: string, status: string): Promise<ActionResult> {
  const parsedStatus = taskStatus.safeParse(status);
  if (!uuid.safeParse(taskId).success || !parsedStatus.success) return fail("Invalid request.");

  const { supabase, workspace } = await getWorkspaceContext();
  const result = await setTaskStatusInWorkspace(supabase, workspace.id, taskId, parsedStatus.data);
  if (!result.ok) return result;

  refresh();
  return ok();
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await deleteTaskInWorkspace(supabase, workspace.id, taskId);
  if (!result.ok) return result;
  refresh();
  return ok();
}

export async function addDependency(taskId: string, dependsOnId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success || !uuid.safeParse(dependsOnId).success) {
    return fail("Choose a task.");
  }
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await addDependencyInWorkspace(supabase, workspace.id, taskId, dependsOnId);
  if (!result.ok) return result;
  refresh();
  return ok();
}

export async function removeDependency(taskId: string, dependsOnId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success || !uuid.safeParse(dependsOnId).success) {
    return fail("Invalid request.");
  }
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await removeDependencyInWorkspace(supabase, workspace.id, taskId, dependsOnId);
  if (!result.ok) return result;
  refresh();
  return ok();
}

/** "Move deadline…": the only way the Planner changes a due date, always on explicit request. */
export async function moveTaskDeadline(
  taskId: string,
  dueDate: string | null,
): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success) return fail("Invalid request.");
  if (dueDate !== null && !isIsoDate(dueDate)) return fail("Enter a valid date.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await setTaskDueDateInWorkspace(supabase, workspace.id, taskId, dueDate);
  if (!result.ok) return result;
  refresh();
  return ok();
}
