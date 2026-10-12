import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  CHILD_PERIOD,
  PARENT_PERIOD,
  periodEnd,
  periodStart,
  shiftPeriod,
  type IsoDate,
  type PlanPeriod,
} from "@/lib/dates";
import type { Db, Tables } from "@/lib/db/types";

// Plan writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning).

export type PeriodRef = { period: PlanPeriod; start: IsoDate };

/**
 * Returns the plan for a period, creating an empty one on first use, so users can start
 * planning at any level. Parent links are kept best-effort: a new plan is attached to an
 * existing parent plan and adopts existing unattached child plans. Nothing requires a parent.
 */
export async function ensurePlanInWorkspace(
  db: Db,
  workspaceId: string,
  weekStart: number,
  target: PeriodRef,
): Promise<ActionResult<{ id: string }>> {
  const existing = await db
    .from("plans")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("period", target.period)
    .eq("period_start", target.start)
    .maybeSingle();
  if (existing.error) return fail("Could not load the plan.");
  if (existing.data) return ok(existing.data);

  const parentPeriod = PARENT_PERIOD[target.period];
  let parentId: string | null = null;
  if (parentPeriod) {
    const parent = await db
      .from("plans")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("period", parentPeriod)
      .eq("period_start", periodStart(parentPeriod, target.start, weekStart))
      .maybeSingle();
    parentId = parent.data?.id ?? null;
  }

  const created = await db
    .from("plans")
    .insert({
      workspace_id: workspaceId,
      period: target.period,
      period_start: target.start,
      parent_plan_id: parentId,
    })
    .select("id")
    .single();
  if (created.error) {
    // Another request created it first.
    if (created.error.code === "23505")
      return ensurePlanInWorkspace(db, workspaceId, weekStart, target);
    return fail("Could not create the plan.");
  }

  const childPeriod = CHILD_PERIOD[target.period];
  if (childPeriod) {
    // Best effort: a child the database rejects (e.g. a week from a different week-start
    // setting) simply stays unattached.
    await db
      .from("plans")
      .update({ parent_plan_id: created.data.id })
      .eq("workspace_id", workspaceId)
      .eq("period", childPeriod)
      .is("parent_plan_id", null)
      .gte("period_start", target.start)
      .lt("period_start", periodEnd(target.period, target.start));
  }
  return ok(created.data);
}

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

export async function linkToPlanInWorkspace(
  db: Db,
  workspaceId: string,
  planId: string,
  link: { task_id: string } | { project_id: string },
): Promise<ActionResult> {
  const { data: last } = await db
    .from("plan_items")
    .select("sort_order")
    .eq("plan_id", planId)
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Composite foreign keys reject a plan, task, or project outside the active workspace.
  const { error } = await db.from("plan_items").insert({
    workspace_id: workspaceId,
    plan_id: planId,
    sort_order: (last?.sort_order ?? -1) + 1,
    ...link,
  });
  if (error) {
    if (error.code === "23505") return fail("That is already linked to this plan.");
    return fail("Could not link it to the plan.");
  }
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

/**
 * Links this period's unfinished task priorities to the next period's plan. Explicit (the user
 * presses a button), idempotent (already-linked tasks are skipped), and it never changes due
 * dates. The original links stay, so the history of what was planned when is kept.
 */
export async function carryForwardInWorkspace(
  db: Db,
  workspaceId: string,
  weekStart: number,
  from: PeriodRef,
): Promise<ActionResult<{ moved: number; next: PeriodRef }>> {
  const next: PeriodRef = { period: from.period, start: shiftPeriod(from.period, from.start, 1) };
  const plan = await db
    .from("plans")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("period", from.period)
    .eq("period_start", from.start)
    .maybeSingle();
  if (plan.error) return fail("Could not load the plan.");
  if (!plan.data) return ok({ moved: 0, next });

  const items = await db
    .from("plan_items")
    .select("task_id")
    .eq("plan_id", plan.data.id)
    .eq("workspace_id", workspaceId)
    .not("task_id", "is", null);
  if (items.error) return fail("Could not load the plan's priorities.");
  const taskIds = items.data.flatMap((i) => (i.task_id ? [i.task_id] : []));
  if (taskIds.length === 0) return ok({ moved: 0, next });

  const open = await db
    .from("tasks")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", taskIds)
    .in("status", ["todo", "in_progress"]);
  if (open.error) return fail("Could not load the plan's priorities.");
  if (open.data.length === 0) return ok({ moved: 0, next });

  const target = await ensurePlanInWorkspace(db, workspaceId, weekStart, next);
  if (!target.ok) return target;
  const already = await db.from("plan_items").select("task_id").eq("plan_id", target.data.id);
  const linked = new Set((already.data ?? []).map((i) => i.task_id));
  const toLink = open.data.filter((t) => !linked.has(t.id));

  let moved = 0;
  for (const task of toLink) {
    const result = await linkToPlanInWorkspace(db, workspaceId, target.data.id, {
      task_id: task.id,
    });
    if (result.ok) moved += 1;
  }
  return ok({ moved, next });
}
