"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { isIsoDate } from "@/lib/dates";
import { fieldErrorsOf } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import {
  createGoalInWorkspace,
  createMilestoneInWorkspace,
  deleteGoalInWorkspace,
  deleteMilestoneInWorkspace,
  moveMilestoneInWorkspace,
  setGoalLinkInWorkspace,
  updateGoalInWorkspace,
  updateMilestoneInWorkspace,
} from "./mutations";
import {
  goalDetailsSchema,
  goalStatusSchema,
  goalTextSchemas,
  goalTitleSchema,
  milestoneTitleSchema,
} from "./schemas";

// Goal text is private: never log it.

const uuid = z.uuid();
const invalid = () => fail("Invalid request.");

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function createGoal(title: string): Promise<ActionResult<{ id: string }>> {
  const parsed = goalTitleSchema.safeParse(title);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await createGoalInWorkspace(supabase, workspace.id, parsed.data));
}

/** Inline edit of the title, "why it matters", or description. */
export async function saveGoalText(
  goalId: string,
  field: keyof typeof goalTextSchemas,
  value: string,
): Promise<ActionResult> {
  const schema = goalTextSchemas[field];
  if (!uuid.safeParse(goalId).success || !schema) return invalid();
  const parsed = schema.safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateGoalInWorkspace(supabase, workspace.id, goalId, { [field]: parsed.data }),
  );
}

export async function setGoalStatus(goalId: string, status: string): Promise<ActionResult> {
  const parsed = goalStatusSchema.safeParse(status);
  if (!uuid.safeParse(goalId).success || !parsed.success) return invalid();
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await updateGoalInWorkspace(supabase, workspace.id, goalId, { status: parsed.data }));
}

export async function saveGoalDetails(goalId: string, input: unknown): Promise<ActionResult> {
  if (!uuid.safeParse(goalId).success) return invalid();
  const parsed = goalDetailsSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await updateGoalInWorkspace(supabase, workspace.id, goalId, parsed.data));
}

/** Quick update of the measurable target's current value. */
export async function setGoalCurrent(goalId: string, value: number): Promise<ActionResult> {
  if (!uuid.safeParse(goalId).success || !Number.isFinite(value) || value < 0 || value > 1e12) {
    return fail("Use 0 or more.");
  }
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateGoalInWorkspace(supabase, workspace.id, goalId, { current_value: value }),
  );
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  if (!uuid.safeParse(goalId).success) return invalid();
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await deleteGoalInWorkspace(supabase, workspace.id, goalId));
}

export async function addMilestone(goalId: string, title: string): Promise<ActionResult> {
  const parsed = milestoneTitleSchema.safeParse(title);
  if (!uuid.safeParse(goalId).success) return invalid();
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await createMilestoneInWorkspace(supabase, workspace.id, goalId, parsed.data);
  return done(result.ok ? ok() : result);
}

export async function renameMilestone(milestoneId: string, title: string): Promise<ActionResult> {
  const parsed = milestoneTitleSchema.safeParse(title);
  if (!uuid.safeParse(milestoneId).success) return invalid();
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateMilestoneInWorkspace(supabase, workspace.id, milestoneId, { title: parsed.data }),
  );
}

export async function setMilestoneDue(
  milestoneId: string,
  dueDate: string | null,
): Promise<ActionResult> {
  if (!uuid.safeParse(milestoneId).success || (dueDate !== null && !isIsoDate(dueDate))) {
    return invalid();
  }
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateMilestoneInWorkspace(supabase, workspace.id, milestoneId, { due_date: dueDate }),
  );
}

export async function setMilestoneDone(
  milestoneId: string,
  isDone: boolean,
): Promise<ActionResult> {
  if (!uuid.safeParse(milestoneId).success) return invalid();
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateMilestoneInWorkspace(supabase, workspace.id, milestoneId, {
      completed_at: isDone ? new Date().toISOString() : null,
    }),
  );
}

export async function moveMilestone(
  milestoneId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  if (!uuid.safeParse(milestoneId).success || (direction !== "up" && direction !== "down")) {
    return invalid();
  }
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await moveMilestoneInWorkspace(supabase, workspace.id, milestoneId, direction));
}

export async function deleteMilestone(milestoneId: string): Promise<ActionResult> {
  if (!uuid.safeParse(milestoneId).success) return invalid();
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await deleteMilestoneInWorkspace(supabase, workspace.id, milestoneId));
}

/** Links a project or task to a goal, or unlinks it (goalId null). */
export async function linkToGoal(
  kind: "project" | "task",
  targetId: string,
  goalId: string | null,
): Promise<ActionResult> {
  if (
    (kind !== "project" && kind !== "task") ||
    !uuid.safeParse(targetId).success ||
    (goalId !== null && !uuid.safeParse(goalId).success)
  ) {
    return invalid();
  }
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await setGoalLinkInWorkspace(supabase, workspace.id, kind, targetId, goalId));
}
