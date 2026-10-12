import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";

// ID-based block writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts). Overlaps are allowed; callers get them back to warn the user.

export type BlockOverlap = { id: string; title: string; starts_at: string; ends_at: string };
export type BlockSaved = { id: string; overlaps: BlockOverlap[] };

const NOT_FOUND = "This block no longer exists.";

function blockError(error: { code?: string; message: string }) {
  if (error.code === "23503") return fail("The linked task or project no longer exists.");
  if (error.code === "23514") return fail("Check the block's times.");
  return fail("Could not save the block. Please try again.");
}

export async function findOverlaps(
  db: Db,
  workspaceId: string,
  span: { starts_at: string; ends_at: string },
  excludeId?: string,
): Promise<BlockOverlap[]> {
  let query = db
    .from("time_blocks")
    .select("id, title, starts_at, ends_at")
    .eq("workspace_id", workspaceId)
    .lt("starts_at", span.ends_at)
    .gt("ends_at", span.starts_at)
    .order("starts_at")
    .limit(20);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  return error ? [] : data;
}

export async function createBlockInWorkspace(
  db: Db,
  workspaceId: string,
  fields: Omit<Tables["time_blocks"]["Insert"], "workspace_id" | "origin">,
): Promise<ActionResult<BlockSaved>> {
  const { data, error } = await db
    .from("time_blocks")
    .insert({ ...fields, workspace_id: workspaceId })
    .select("id, starts_at, ends_at")
    .single();
  if (error) return blockError(error);
  return ok({ id: data.id, overlaps: await findOverlaps(db, workspaceId, data, data.id) });
}

export async function updateBlockInWorkspace(
  db: Db,
  workspaceId: string,
  blockId: string,
  fields: Pick<
    Tables["time_blocks"]["Update"],
    "title" | "notes" | "starts_at" | "ends_at" | "timezone" | "task_id" | "project_id"
  >,
): Promise<ActionResult<BlockSaved>> {
  const { data, error } = await db
    .from("time_blocks")
    .update(fields)
    .eq("id", blockId)
    .eq("workspace_id", workspaceId)
    .select("id, starts_at, ends_at");
  if (error) return blockError(error);
  const saved = data[0];
  if (!saved) return fail(NOT_FOUND);
  return ok({ id: saved.id, overlaps: await findOverlaps(db, workspaceId, saved, saved.id) });
}

export async function deleteBlockInWorkspace(
  db: Db,
  workspaceId: string,
  blockId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("time_blocks")
    .delete()
    .eq("id", blockId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the block.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}
