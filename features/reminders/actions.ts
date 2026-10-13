"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getWorkspaceContext } from "@/lib/workspace-context";
import type { ReminderPrefs } from "./logic";
import { dismissReminderInWorkspace, setReminderPreferencesInWorkspace } from "./mutations";

const keySchema = z.string().min(1).max(200);
const prefsSchema = z.object({ task: z.boolean(), habit: z.boolean(), time_block: z.boolean() });

export async function dismissReminder(key: string): Promise<ActionResult> {
  const parsed = keySchema.safeParse(key);
  if (!parsed.success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await dismissReminderInWorkspace(supabase, workspace.id, parsed.data);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return ok();
}

export async function setReminderPreferences(prefs: ReminderPrefs): Promise<ActionResult> {
  const parsed = prefsSchema.safeParse(prefs);
  if (!parsed.success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await setReminderPreferencesInWorkspace(supabase, workspace.id, parsed.data);
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return ok();
}
