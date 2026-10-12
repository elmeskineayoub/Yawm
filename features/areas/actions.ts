"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, formObject, requiredText } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import {
  createAreaInWorkspace,
  deleteAreaInWorkspace,
  moveAreaInWorkspace,
  updateAreaInWorkspace,
} from "./mutations";

const uuid = z.uuid();
const areaSchema = z.object({
  name: requiredText(50, "Name the area."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a color."),
});

function done(result: ActionResult): ActionResult {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function createArea(formData: FormData): Promise<ActionResult> {
  const parsed = areaSchema.safeParse(formObject(formData, ["name", "color"]));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await createAreaInWorkspace(supabase, workspace.id, parsed.data));
}

export async function updateArea(areaId: string, formData: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(areaId).success) return fail("Invalid request.");
  const parsed = areaSchema.safeParse(formObject(formData, ["name", "color"]));
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await updateAreaInWorkspace(supabase, workspace.id, areaId, parsed.data));
}

export async function moveArea(areaId: string, direction: "up" | "down"): Promise<ActionResult> {
  if (!uuid.safeParse(areaId).success || (direction !== "up" && direction !== "down")) {
    return fail("Invalid request.");
  }
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await moveAreaInWorkspace(supabase, workspace.id, areaId, direction));
}

export async function setAreaArchived(areaId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(areaId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateAreaInWorkspace(supabase, workspace.id, areaId, {
      archived_at: archived ? new Date().toISOString() : null,
    }),
  );
}

export async function deleteArea(areaId: string): Promise<ActionResult> {
  if (!uuid.safeParse(areaId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await deleteAreaInWorkspace(supabase, workspace.id, areaId));
}
