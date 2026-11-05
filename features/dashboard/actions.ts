"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { dashboardPrefsSchema, serializeHidden } from "./sections";

/** Saves which Dashboard sections are hidden, on the caller's own profile (RLS: own row only). */
export async function saveDashboardPrefs(prefs: unknown): Promise<ActionResult> {
  const parsed = dashboardPrefsSchema.safeParse(prefs);
  if (!parsed.success) return fail("Invalid preference.");
  const { supabase, user } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("profiles")
    .update({ dashboard_prefs: serializeHidden(parsed.data.hidden) })
    .eq("id", user.id)
    .select("id");
  if (error) {
    // Most likely the migration adding the column has not been applied yet.
    return fail("Couldn't save your dashboard layout. Please try again.");
  }
  if (!data.length) return fail("Your profile could not be found.");
  revalidatePath("/dashboard");
  return ok();
}
