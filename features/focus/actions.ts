"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { deleteFocusSessionInWorkspace, logFocusSessionInWorkspace } from "./mutations";
import { focusSessionSchema } from "./schemas";

/** Logs a finished focus or break session. Safe to call twice for the same id (idempotent). */
export async function logFocusSession(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = focusSessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await logFocusSessionInWorkspace(supabase, workspace.id, parsed.data);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return result;
}

export async function deleteFocusSession(sessionId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(sessionId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await deleteFocusSessionInWorkspace(supabase, workspace.id, sessionId);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return ok();
}
