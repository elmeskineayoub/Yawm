"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { isIsoDate } from "@/lib/dates";
import { fieldErrorsOf, formObject, parseTagNames } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { friendlyTaskError } from "./logic";
import {
  addDependencyInWorkspace,
  deleteTaskInWorkspace,
  removeDependencyInWorkspace,
  setTaskDueDateInWorkspace,
  patchTaskInWorkspace,
  setTaskStatusInWorkspace,
  setTaskTagsInWorkspace,
} from "./mutations";
import { mergeTaskPatch, PATCH_SOURCE_COLUMNS } from "./patch";
import { quickTaskSchema, taskStatus } from "./schemas";

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

/**
 * Saves a partial change from the task detail (each field autosaves on its own). The change is
 * merged into the stored row and validated with every cross-field rule (see patch.ts).
 */
export async function updateTaskFields(taskId: string, patch: unknown): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success) return fail("Unknown task.");

  const { supabase, workspace } = await getWorkspaceContext();
  const { data: row, error } = await supabase
    .from("tasks")
    .select(PATCH_SOURCE_COLUMNS)
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (error) return fail("Could not save. Please try again.");
  if (!row) return fail("This task no longer exists.");

  const merged = mergeTaskPatch(row, patch);
  if (!merged.ok) return fail(merged.error, merged.fieldErrors);

  const result = await patchTaskInWorkspace(supabase, workspace.id, taskId, merged.data);
  if (!result.ok) return result;
  refresh();
  return ok();
}

/** Replaces a task's tags from a comma-separated list. */
export async function setTaskTags(taskId: string, tags: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success || typeof tags !== "string" || tags.length > 2000) {
    return fail("Invalid request.");
  }
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await setTaskTagsInWorkspace(supabase, workspace.id, taskId, parseTagNames(tags));
  if (!result.ok) return result;
  refresh();
  return ok();
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

const deadlineMoves = z
  .array(z.object({ id: z.uuid(), due: z.string().nullable() }))
  .min(1)
  .max(100);

/**
 * Moves several deadlines at once (Today's "Move all to today", and its Undo). Always an explicit
 * user action; nothing moves on its own. Each task is checked against the active workspace. Moves
 * that fail are reported; the others still apply.
 */
export async function moveTaskDeadlines(
  moves: unknown,
): Promise<ActionResult<{ moved: number; failed: number }>> {
  const parsed = deadlineMoves.safeParse(moves);
  if (!parsed.success || parsed.data.some((m) => m.due !== null && !isIsoDate(m.due))) {
    return fail("Invalid request.");
  }
  const { supabase, workspace } = await getWorkspaceContext();
  let moved = 0;
  for (const move of parsed.data) {
    const result = await setTaskDueDateInWorkspace(supabase, workspace.id, move.id, move.due);
    if (result.ok) moved += 1;
  }
  refresh();
  const failed = parsed.data.length - moved;
  if (moved === 0) return fail("Couldn't move those deadlines. Please try again.");
  return ok({ moved, failed });
}
