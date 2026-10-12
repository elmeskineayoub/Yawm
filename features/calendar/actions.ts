"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { fieldErrorsOf } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import {
  createBlockInWorkspace,
  deleteBlockInWorkspace,
  updateBlockInWorkspace,
  type BlockSaved,
} from "./mutations";
import { blockInputSchema, blockTimesSchema } from "./schemas";

// Block titles and notes are private: never log them.

const uuid = z.uuid();

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export type BlockFields = {
  title: string;
  notes?: string | null;
  starts_at: string;
  ends_at: string;
  task_id?: string | null;
  project_id?: string | null;
};

export async function createBlock(input: BlockFields): Promise<ActionResult<BlockSaved>> {
  const parsed = blockInputSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase, workspace, timezone } = await getWorkspaceContext();
  return done(await createBlockInWorkspace(supabase, workspace.id, { ...parsed.data, timezone }));
}

export async function updateBlock(
  blockId: string,
  input: BlockFields,
): Promise<ActionResult<BlockSaved>> {
  if (!uuid.safeParse(blockId).success) return fail("Invalid request.");
  const parsed = blockInputSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase, workspace, timezone } = await getWorkspaceContext();
  return done(
    await updateBlockInWorkspace(supabase, workspace.id, blockId, { ...parsed.data, timezone }),
  );
}

/** Drag to move or resize: only the times change. */
export async function moveBlock(
  blockId: string,
  startsAt: string,
  endsAt: string,
): Promise<ActionResult<BlockSaved>> {
  const parsed = blockTimesSchema.safeParse({ starts_at: startsAt, ends_at: endsAt });
  if (!uuid.safeParse(blockId).success || !parsed.success) {
    return fail("A block must end after it starts and last at most 24 hours.");
  }
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await updateBlockInWorkspace(supabase, workspace.id, blockId, parsed.data));
}

/** Schedules time for a task. The task's due date (its deadline) is not changed. */
export async function scheduleTask(
  taskId: string,
  startsAt: string,
  endsAt: string,
): Promise<ActionResult<BlockSaved>> {
  if (!uuid.safeParse(taskId).success) return fail("Invalid request.");
  const { supabase, workspace, timezone } = await getWorkspaceContext();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!task) return fail("This task no longer exists.");
  const parsed = blockInputSchema.safeParse({
    title: task.title.slice(0, 200),
    starts_at: startsAt,
    ends_at: endsAt,
    task_id: task.id,
  });
  if (!parsed.success) return fail("A block must end after it starts and last at most 24 hours.");
  return done(await createBlockInWorkspace(supabase, workspace.id, { ...parsed.data, timezone }));
}

export async function deleteBlock(blockId: string): Promise<ActionResult> {
  if (!uuid.safeParse(blockId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await deleteBlockInWorkspace(supabase, workspace.id, blockId));
}
