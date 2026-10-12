"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { isIsoDate, periodStart, type IsoDate, type PlanPeriod } from "@/lib/dates";
import { optionalText } from "@/lib/form";
import { escapeLike } from "@/lib/search";
import { getWorkspaceContext, type WorkspaceContext } from "@/lib/workspace-context";
import {
  carryForwardInWorkspace,
  ensurePlanInWorkspace,
  linkToPlanInWorkspace,
  unlinkPlanItemInWorkspace,
  updatePlanNotesInWorkspace,
  type PeriodRef,
  type PlanLink,
} from "./mutations";

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

async function ensurePlan(
  ctx: WorkspaceContext,
  target: PeriodRef,
): Promise<{ id: string } | { error: string }> {
  const result = await ensurePlanInWorkspace(ctx.supabase, ctx.workspace.id, ctx.weekStart, target);
  return result.ok ? result.data : { error: result.error };
}

const LINK_COLUMNS = {
  task: "task_id",
  project: "project_id",
  goal: "goal_id",
  milestone: "milestone_id",
} as const;

export async function linkToPlan(
  rawPeriod: string,
  start: string,
  kind: LinkableKind,
  targetId: string,
): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  const target = checkPeriod(ctx, rawPeriod, start);
  const column = LINK_COLUMNS[kind];
  if (!target || !column || !uuid.safeParse(targetId).success) {
    return fail("Choose something to link.");
  }

  const plan = await ensurePlan(ctx, target);
  if ("error" in plan) return fail(plan.error);
  const result = await linkToPlanInWorkspace(ctx.supabase, ctx.workspace.id, plan.id, {
    [column]: targetId,
  } as PlanLink);
  if (!result.ok) return result;
  refresh();
  return ok();
}

export async function unlinkFromPlan(itemId: string): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await unlinkPlanItemInWorkspace(supabase, workspace.id, itemId);
  if (!result.ok) return result;
  refresh();
  return ok();
}

const planField = z.enum(["theme", "focus", "reflection"]);

/** Inline autosave of one plan field. Creates the plan on first use. */
export async function savePlanField(
  rawPeriod: string,
  start: string,
  field: string,
  value: string,
): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  const target = checkPeriod(ctx, rawPeriod, start);
  const parsedField = planField.safeParse(field);
  if (!target || !parsedField.success) return fail("Unknown planning period.");
  const parsed = planSchema.shape[parsedField.data].safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check this field.");

  const plan = await ensurePlan(ctx, target);
  if ("error" in plan) return fail(plan.error);
  const result = await updatePlanNotesInWorkspace(ctx.supabase, ctx.workspace.id, plan.id, {
    [parsedField.data]: parsed.data,
  });
  if (!result.ok) return result;
  refresh();
  return ok();
}

const priorityTitle = z.string().trim().min(1, "Write the priority first.").max(200);

/**
 * Creates a task (week/day), project (month outcome), or goal (year outcome) and links it to the
 * period's plan in one database transaction.
 */
export async function addPriority(
  rawPeriod: string,
  start: string,
  kind: "task" | "project" | "goal",
  title: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getWorkspaceContext();
  const target = checkPeriod(ctx, rawPeriod, start);
  if (!target || !["task", "project", "goal"].includes(kind)) {
    return fail("Unknown planning period.");
  }
  const parsed = priorityTitle.safeParse(title);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the title.");

  const plan = await ensurePlan(ctx, target);
  if ("error" in plan) return fail(plan.error);
  const { data, error } =
    kind === "task"
      ? await ctx.supabase.rpc("add_task_to_plan", {
          target_plan_id: plan.id,
          task_title: parsed.data,
        })
      : kind === "goal"
        ? await ctx.supabase.rpc("add_goal_to_plan", {
            target_plan_id: plan.id,
            goal_title: parsed.data,
          })
        : await ctx.supabase.rpc("add_project_to_plan", {
            target_plan_id: plan.id,
            project_name: parsed.data,
          });
  if (error || !data) return fail("Could not add the priority. Please try again.");
  refresh();
  return ok({ id: data });
}

export type LinkableKind = "task" | "project" | "goal" | "milestone";
export type Linkable = { kind: LinkableKind; id: string; title: string; detail: string };

const ALL_KINDS: LinkableKind[] = ["task", "project", "goal", "milestone"];

/** Search open tasks, active projects, goals, and open milestones, in the active workspace only. */
export async function searchLinkable(
  query: string,
  kinds: LinkableKind[] = ["task", "project"],
): Promise<ActionResult<Linkable[]>> {
  const q = query.trim().slice(0, 100);
  const wanted = new Set(kinds.filter((k) => ALL_KINDS.includes(k)));
  const { supabase, workspace } = await getWorkspaceContext();
  const pattern = `%${escapeLike(q)}%`;
  const none = Promise.resolve({ data: [], error: null });
  const [tasks, projects, goals, milestones] = await Promise.all([
    wanted.has("task")
      ? supabase
          .from("tasks")
          .select("id, title, due_date")
          .eq("workspace_id", workspace.id)
          .in("status", ["todo", "in_progress"])
          .ilike("title", pattern)
          .order("created_at", { ascending: false })
          .limit(12)
      : none,
    wanted.has("project")
      ? supabase
          .from("projects")
          .select("id, name, status")
          .eq("workspace_id", workspace.id)
          .in("status", ["planned", "active", "on_hold"])
          .ilike("name", pattern)
          .order("name")
          .limit(8)
      : none,
    wanted.has("goal")
      ? supabase
          .from("goals")
          .select("id, title, target_date")
          .eq("workspace_id", workspace.id)
          .in("status", ["active", "paused"])
          .ilike("title", pattern)
          .order("sort_order")
          .limit(8)
      : none,
    wanted.has("milestone")
      ? supabase
          .from("milestones")
          .select("id, title, due_date, goals(title)")
          .eq("workspace_id", workspace.id)
          .is("completed_at", null)
          .ilike("title", pattern)
          .order("due_date", { nullsFirst: false })
          .limit(8)
      : none,
  ]);
  if (tasks.error || projects.error || goals.error || milestones.error) {
    return fail("Search failed. Please try again.");
  }
  return ok([
    ...(goals.data ?? []).map((g) => ({
      kind: "goal" as const,
      id: g.id,
      title: g.title,
      detail: g.target_date ? `Goal · by ${g.target_date}` : "Goal",
    })),
    ...(milestones.data ?? []).map((m) => ({
      kind: "milestone" as const,
      id: m.id,
      title: m.title,
      detail: `Milestone · ${m.goals?.title ?? "goal"}${m.due_date ? ` · due ${m.due_date}` : ""}`,
    })),
    ...(projects.data ?? []).map((p) => ({
      kind: "project" as const,
      id: p.id,
      title: p.name,
      detail: "Project",
    })),
    ...(tasks.data ?? []).map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: t.title,
      detail: t.due_date ? `Task · due ${t.due_date}` : "Task",
    })),
  ]);
}

/** Explicitly carries unfinished task priorities to the next period. Due dates are unchanged. */
export async function carryForward(
  rawPeriod: string,
  start: string,
): Promise<ActionResult<{ moved: number; next: PeriodRef }>> {
  const ctx = await getWorkspaceContext();
  const target = checkPeriod(ctx, rawPeriod, start);
  if (!target) return fail("Unknown planning period.");
  const result = await carryForwardInWorkspace(
    ctx.supabase,
    ctx.workspace.id,
    ctx.weekStart,
    target,
  );
  if (result.ok) refresh();
  return result;
}
