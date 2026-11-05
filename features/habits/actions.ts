"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { isIsoDate } from "@/lib/dates";
import { fieldErrorsOf } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import {
  createHabitInWorkspace,
  deleteHabitInWorkspace,
  setHabitLogInWorkspace,
  updateHabitInWorkspace,
} from "./mutations";
import { habitSchema, logEntrySchema, type LogEntry } from "./schemas";

const uuid = z.uuid();

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/**
 * Creates a habit from the "New habit" form. A bare name (string) still works: every day, from
 * today. Fields left empty fall back to the same defaults.
 */
export async function createHabit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await getWorkspaceContext();
  const fields: Record<string, unknown> =
    typeof input === "string"
      ? { title: input }
      : input && typeof input === "object"
        ? { ...(input as Record<string, unknown>) }
        : {};
  if (!fields.starts_on) fields.starts_on = ctx.today;
  const parsed = habitSchema.safeParse(fields);
  if (!parsed.success) {
    const errors = fieldErrorsOf(parsed.error);
    return fail(
      Object.keys(errors).length === 1 && errors.title
        ? "Name the habit."
        : "Check the highlighted fields.",
      errors,
    );
  }
  return done(await createHabitInWorkspace(ctx.supabase, ctx.workspace.id, parsed.data));
}

export async function updateHabit(habitId: string, input: unknown): Promise<ActionResult> {
  if (!uuid.safeParse(habitId).success) return fail("Invalid request.");
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await updateHabitInWorkspace(supabase, workspace.id, habitId, parsed.data));
}

const renameSchema = z.string().trim().min(1, "Name the habit.").max(200);

export async function renameHabit(habitId: string, title: string): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(title);
  if (!uuid.safeParse(habitId).success) return fail("Invalid request.");
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateHabitInWorkspace(supabase, workspace.id, habitId, { title: parsed.data }),
  );
}

export async function setHabitArchived(habitId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(habitId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateHabitInWorkspace(supabase, workspace.id, habitId, {
      archived_at: archived ? new Date().toISOString() : null,
    }),
  );
}

export async function deleteHabit(habitId: string): Promise<ActionResult> {
  if (!uuid.safeParse(habitId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await deleteHabitInWorkspace(supabase, workspace.id, habitId));
}

/** Records a day: done/amount, rest day, or clear. Past days can be edited too. */
export async function logHabit(
  habitId: string,
  date: string,
  entry: LogEntry,
): Promise<ActionResult> {
  const parsed = logEntrySchema.safeParse(entry);
  if (!uuid.safeParse(habitId).success || !isIsoDate(date) || !parsed.success) {
    return fail("Invalid request.");
  }
  const { supabase, workspace, today } = await getWorkspaceContext();
  const result = await setHabitLogInWorkspace(
    supabase,
    workspace.id,
    habitId,
    date,
    parsed.data,
    today,
  );
  return done(result.ok ? ok() : result);
}
