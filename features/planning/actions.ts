"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, toSaveState, type ActionResult, type SaveState } from "@/lib/action-result";
import {
  CHILD_PERIOD,
  isIsoDate,
  PARENT_PERIOD,
  periodEnd,
  periodStart,
  type IsoDate,
  type PlanPeriod,
} from "@/lib/dates";
import { fieldErrorsOf, formObject, optionalText } from "@/lib/form";
import { getWorkspaceContext, type WorkspaceContext } from "@/lib/workspace-context";

const uuid = z.uuid();
const period = z.enum(["year", "month", "week", "day"]);

const planSchema = z.object({
  theme: optionalText(200),
  focus: optionalText(5000),
  reflection: optionalText(10000),
});

function refresh() {
  revalidatePath("/", "layout");
}

/** Validates the period/start pair against the user's week-start preference. */
function checkPeriod(
  ctx: WorkspaceContext,
  rawPeriod: string,
  start: string,
): { period: PlanPeriod; start: IsoDate } | null {
  const parsed = period.safeParse(rawPeriod);
  if (!parsed.success || !isIsoDate(start)) return null;
  if (periodStart(parsed.data, start, ctx.weekStart) !== start) return null;
  return { period: parsed.data, start };
}

/**
 * Returns the plan for a period, creating an empty one if needed. New plans are linked to an
 * existing parent plan, and adopt existing child plans that have no parent yet.
 */
async function ensurePlan(
  ctx: WorkspaceContext,
  target: { period: PlanPeriod; start: IsoDate },
): Promise<{ id: string } | { error: string }> {
  const { supabase, workspace, weekStart } = ctx;
  const existing = await supabase
    .from("plans")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("period", target.period)
    .eq("period_start", target.start)
    .maybeSingle();
  if (existing.error) return { error: "Could not load the plan." };
  if (existing.data) return existing.data;

  const parentPeriod = PARENT_PERIOD[target.period];
  let parentId: string | null = null;
  if (parentPeriod) {
    const parent = await supabase
      .from("plans")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("period", parentPeriod)
      .eq("period_start", periodStart(parentPeriod, target.start, weekStart))
      .maybeSingle();
    parentId = parent.data?.id ?? null;
  }

  const created = await supabase
    .from("plans")
    .insert({
      workspace_id: workspace.id,
      period: target.period,
      period_start: target.start,
      parent_plan_id: parentId,
    })
    .select("id")
    .single();
  if (created.error) {
    // Another request created it first.
    if (created.error.code === "23505") return ensurePlan(ctx, target);
    return { error: "Could not create the plan." };
  }

  const childPeriod = CHILD_PERIOD[target.period];
  if (childPeriod) {
    // Best effort: a child the database rejects (e.g. a week from a different week-start
    // setting) simply stays unlinked.
    await supabase
      .from("plans")
      .update({ parent_plan_id: created.data.id })
      .eq("workspace_id", workspace.id)
      .eq("period", childPeriod)
      .is("parent_plan_id", null)
      .gte("period_start", target.start)
      .lt("period_start", periodEnd(target.period, target.start));
  }
  return created.data;
}

export async function savePlan(
  rawPeriod: string,
  start: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const ctx = await getWorkspaceContext();
  const target = checkPeriod(ctx, rawPeriod, start);
  if (!target) return { status: "error", message: "Unknown planning period." };
  const parsed = planSchema.safeParse(formObject(formData, ["theme", "focus", "reflection"]));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  const plan = await ensurePlan(ctx, target);
  if ("error" in plan) return { status: "error", message: plan.error };
  const { error } = await ctx.supabase.from("plans").update(parsed.data).eq("id", plan.id);
  if (error) return { status: "error", message: "Could not save the plan. Please try again." };
  refresh();
  return toSaveState(ok());
}

export async function linkToPlan(
  rawPeriod: string,
  start: string,
  kind: "task" | "project",
  targetId: string,
): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  const target = checkPeriod(ctx, rawPeriod, start);
  if (!target || !uuid.safeParse(targetId).success) return fail("Choose something to link.");

  const plan = await ensurePlan(ctx, target);
  if ("error" in plan) return fail(plan.error);
  const { error } = await ctx.supabase.from("plan_items").insert({
    workspace_id: ctx.workspace.id,
    plan_id: plan.id,
    ...(kind === "task" ? { task_id: targetId } : { project_id: targetId }),
  });
  if (error) {
    if (error.code === "23505") return fail("That is already linked to this plan.");
    return fail("Could not link it to the plan.");
  }
  refresh();
  return ok();
}

export async function unlinkFromPlan(itemId: string): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return fail("Invalid request.");
  const { supabase } = await getWorkspaceContext();
  const { error } = await supabase.from("plan_items").delete().eq("id", itemId);
  if (error) return fail("Could not remove the link.");
  refresh();
  return ok();
}
