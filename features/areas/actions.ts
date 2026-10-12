"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, formObject, requiredText } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";

const uuid = z.uuid();
const areaSchema = z.object({
  name: requiredText(50, "Name the area."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a color."),
});

function refresh() {
  revalidatePath("/", "layout");
}

function areaError(error: { code?: string }) {
  return error.code === "23505"
    ? fail("An active area with that name already exists.", {
        name: ["An active area with that name already exists."],
      })
    : fail("Could not save the area. Please try again.");
}

export async function createArea(formData: FormData): Promise<ActionResult> {
  const parsed = areaSchema.safeParse(formObject(formData, ["name", "color"]));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase, workspace } = await getWorkspaceContext();
  const { data: last } = await supabase
    .from("areas")
    .select("sort_order")
    .eq("workspace_id", workspace.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("areas").insert({
    workspace_id: workspace.id,
    ...parsed.data,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return areaError(error);
  refresh();
  return ok();
}

export async function updateArea(areaId: string, formData: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(areaId).success) return fail("Invalid request.");
  const parsed = areaSchema.safeParse(formObject(formData, ["name", "color"]));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("areas")
    .update(parsed.data)
    .eq("id", areaId)
    .select("id");
  if (error) return areaError(error);
  if (!data.length) return fail("This area no longer exists.");
  refresh();
  return ok();
}

/** Swaps the area with its neighbour and renumbers the list so the order stays contiguous. */
export async function moveArea(areaId: string, direction: "up" | "down"): Promise<ActionResult> {
  if (!uuid.safeParse(areaId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const { data: areas, error } = await supabase
    .from("areas")
    .select("id, sort_order")
    .eq("workspace_id", workspace.id)
    .order("sort_order")
    .order("name");
  if (error) return fail("Could not reorder areas.");

  const ids = areas.map((a) => a.id);
  const index = ids.indexOf(areaId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return ok();
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];

  const changed = ids
    .map((id, position) => ({ id, position }))
    .filter(({ id, position }) => areas.find((a) => a.id === id)?.sort_order !== position);
  const results = await Promise.all(
    changed.map(({ id, position }) =>
      supabase.from("areas").update({ sort_order: position }).eq("id", id),
    ),
  );
  if (results.some((r) => r.error)) return fail("Could not reorder areas. Please try again.");
  refresh();
  return ok();
}

export async function setAreaArchived(areaId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(areaId).success) return fail("Invalid request.");
  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("areas")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", areaId)
    .select("id");
  if (error) return areaError(error);
  if (!data.length) return fail("This area no longer exists.");
  refresh();
  return ok();
}

/** Linked tasks and projects are kept and lose their area (the foreign key sets it to null). */
export async function deleteArea(areaId: string): Promise<ActionResult> {
  if (!uuid.safeParse(areaId).success) return fail("Invalid request.");
  const { supabase } = await getWorkspaceContext();
  const { data, error } = await supabase.from("areas").delete().eq("id", areaId).select("id");
  if (error) return fail("Could not delete the area.");
  if (!data.length) return fail("This area no longer exists.");
  refresh();
  return ok();
}
