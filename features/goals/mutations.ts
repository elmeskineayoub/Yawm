import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";

// ID-based goal and milestone writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning). Links to goals are composite foreign keys, so
// a goal from another workspace is rejected by the database as well.

const GOAL_NOT_FOUND = "This goal no longer exists.";
const MILESTONE_NOT_FOUND = "This milestone no longer exists.";

async function nextGoalOrder(db: Db, workspaceId: string) {
  const { data } = await db
    .from("goals")
    .select("sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

async function nextMilestoneOrder(db: Db, workspaceId: string, goalId: string) {
  const { data } = await db
    .from("milestones")
    .select("sort_order")
    .eq("workspace_id", workspaceId)
    .eq("goal_id", goalId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

export async function createGoalInWorkspace(
  db: Db,
  workspaceId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await db
    .from("goals")
    .insert({
      workspace_id: workspaceId,
      title,
      sort_order: await nextGoalOrder(db, workspaceId),
    })
    .select("id")
    .single();
  if (error) return fail("Could not add the goal. Please try again.");
  return ok({ id: data.id });
}

export async function updateGoalInWorkspace(
  db: Db,
  workspaceId: string,
  goalId: string,
  fields: Tables["goals"]["Update"],
): Promise<ActionResult> {
  const { data, error } = await db
    .from("goals")
    .update(fields)
    .eq("id", goalId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) {
    if (error.code === "23503") return fail("Choose a life area from this workspace.");
    return fail("Could not save the goal. Please try again.");
  }
  if (!data.length) return fail(GOAL_NOT_FOUND);
  return ok();
}

export async function deleteGoalInWorkspace(
  db: Db,
  workspaceId: string,
  goalId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the goal.");
  if (!data.length) return fail(GOAL_NOT_FOUND);
  return ok();
}

export async function createMilestoneInWorkspace(
  db: Db,
  workspaceId: string,
  goalId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await db
    .from("milestones")
    .insert({
      workspace_id: workspaceId,
      goal_id: goalId,
      title,
      sort_order: await nextMilestoneOrder(db, workspaceId, goalId),
    })
    .select("id")
    .single();
  if (error) return fail(error.code === "23503" ? GOAL_NOT_FOUND : "Could not add the milestone.");
  return ok({ id: data.id });
}

export async function updateMilestoneInWorkspace(
  db: Db,
  workspaceId: string,
  milestoneId: string,
  fields: Pick<Tables["milestones"]["Update"], "title" | "due_date" | "completed_at">,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("milestones")
    .update(fields)
    .eq("id", milestoneId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not save the milestone. Please try again.");
  if (!data.length) return fail(MILESTONE_NOT_FOUND);
  return ok();
}

export async function deleteMilestoneInWorkspace(
  db: Db,
  workspaceId: string,
  milestoneId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the milestone.");
  if (!data.length) return fail(MILESTONE_NOT_FOUND);
  return ok();
}

/** Moves a milestone one place up or down, renumbering its goal's milestones 0…n-1. */
export async function moveMilestoneInWorkspace(
  db: Db,
  workspaceId: string,
  milestoneId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const { data: target } = await db
    .from("milestones")
    .select("goal_id")
    .eq("id", milestoneId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!target) return fail(MILESTONE_NOT_FOUND);
  const { data: siblings, error } = await db
    .from("milestones")
    .select("id, sort_order")
    .eq("goal_id", target.goal_id)
    .eq("workspace_id", workspaceId)
    .order("sort_order")
    .order("created_at");
  if (error) return fail("Could not reorder the milestones.");
  const order = siblings.map((m) => m.id);
  const from = order.indexOf(milestoneId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= order.length) return ok();
  [order[from], order[to]] = [order[to]!, order[from]!];
  const changed = order.flatMap((id, index) =>
    siblings.find((m) => m.id === id)?.sort_order === index ? [] : [{ id, index }],
  );
  for (const { id, index } of changed) {
    const { error: updateError } = await db
      .from("milestones")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (updateError) return fail("Could not reorder the milestones.");
  }
  return ok();
}

/** Links (or unlinks, with null) a project or task to a goal in the active workspace. */
export async function setGoalLinkInWorkspace(
  db: Db,
  workspaceId: string,
  kind: "project" | "task",
  targetId: string,
  goalId: string | null,
): Promise<ActionResult> {
  const table = kind === "project" ? "projects" : "tasks";
  const { data, error } = await db
    .from(table)
    .update({ goal_id: goalId })
    .eq("id", targetId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) {
    if (error.code === "23503") return fail(GOAL_NOT_FOUND);
    return fail("Could not update the link. Please try again.");
  }
  if (!data.length) return fail(`This ${kind} no longer exists.`);
  return ok();
}
