import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";

// ID-based area writes, scoped to the active workspace in addition to RLS (see
// features/tasks/mutations.ts for the reasoning).

const NOT_FOUND = "This area no longer exists.";

function areaError(error: { code?: string }) {
  return error.code === "23505"
    ? fail("An active area with that name already exists.", {
        name: ["An active area with that name already exists."],
      })
    : fail("Could not save the area. Please try again.");
}

export async function createAreaInWorkspace(
  db: Db,
  workspaceId: string,
  fields: { name: string; color: string },
): Promise<ActionResult> {
  const { data: last } = await db
    .from("areas")
    .select("sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db.from("areas").insert({
    workspace_id: workspaceId,
    ...fields,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return areaError(error);
  return ok();
}

export async function updateAreaInWorkspace(
  db: Db,
  workspaceId: string,
  areaId: string,
  fields: Pick<Tables["areas"]["Update"], "name" | "color" | "archived_at">,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("areas")
    .update(fields)
    .eq("id", areaId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return areaError(error);
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

/** Swaps the area with its neighbour and renumbers the list so the order stays contiguous. */
export async function moveAreaInWorkspace(
  db: Db,
  workspaceId: string,
  areaId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const { data: areas, error } = await db
    .from("areas")
    .select("id, sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order")
    .order("name");
  if (error) return fail("Could not reorder areas.");

  const ids = areas.map((a) => a.id);
  const index = ids.indexOf(areaId);
  if (index < 0) return fail(NOT_FOUND);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return ok();
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];

  const changed = ids
    .map((id, position) => ({ id, position }))
    .filter(({ id, position }) => areas.find((a) => a.id === id)?.sort_order !== position);
  const results = await Promise.all(
    changed.map(({ id, position }) =>
      db
        .from("areas")
        .update({ sort_order: position })
        .eq("id", id)
        .eq("workspace_id", workspaceId),
    ),
  );
  if (results.some((r) => r.error)) return fail("Could not reorder areas. Please try again.");
  return ok();
}

/** Linked tasks and projects are kept and lose their area (the foreign key sets it to null). */
export async function deleteAreaInWorkspace(
  db: Db,
  workspaceId: string,
  areaId: string,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("areas")
    .delete()
    .eq("id", areaId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the area.");
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}
