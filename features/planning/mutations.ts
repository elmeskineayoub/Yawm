import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";

// ID-based plan writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning).

export async function updatePlanNotesInWorkspace(
  db: Db,
  workspaceId: string,
  planId: string,
  fields: Pick<Tables["plans"]["Update"], "theme" | "focus" | "reflection">,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("plans")
    .update(fields)
    .eq("id", planId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not save the plan. Please try again.");
  if (!data.length) return fail("This plan no longer exists.");
  return ok();
}

export async function unlinkPlanItemInWorkspace(
  db: Db,
  workspaceId: string,
  itemId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("plan_items")
    .delete()
    .eq("id", itemId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not remove the link.");
  if (!data.length) return fail("That link no longer exists.");
  return ok();
}
