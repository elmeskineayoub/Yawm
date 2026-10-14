import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";
import { isSupportedImage } from "@/lib/image-signature";
import { isCardImagePath, reorder, VISION_BUCKET } from "./logic";

// ID-based vision-board writes, scoped to the active workspace in addition to RLS and the
// Storage policies. Image files are removed from Storage when a card no longer uses them.

const NOT_FOUND = "This card no longer exists.";

async function loadCard(db: Db, workspaceId: string, cardId: string) {
  const { data } = await db
    .from("vision_board_items")
    .select("id, image_path, title, body")
    .eq("id", cardId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data;
}

/** Best effort: a leftover file is private and harmless, so failures here don't fail the action. */
async function removeFiles(db: Db, paths: string[]) {
  if (paths.length) await db.storage.from(VISION_BUCKET).remove(paths);
}

export async function createCardInWorkspace(
  db: Db,
  workspaceId: string,
  fields: Pick<Tables["vision_board_items"]["Insert"], "title" | "body" | "area_id" | "goal_id">,
): Promise<ActionResult<{ id: string }>> {
  const { data: last } = await db
    .from("vision_board_items")
    .select("sort_order")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("vision_board_items")
    .insert({ ...fields, workspace_id: workspaceId, sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23514") return fail("Give the card a title, text, or an image.");
    if (error.code === "23503") return fail("Choose a goal and life area from this workspace.");
    return fail("Could not add the card. Please try again.");
  }
  return ok({ id: data.id });
}

export async function updateCardInWorkspace(
  db: Db,
  workspaceId: string,
  cardId: string,
  fields: Tables["vision_board_items"]["Update"],
): Promise<ActionResult> {
  const { data, error } = await db
    .from("vision_board_items")
    .update(fields)
    .eq("id", cardId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) {
    if (error.code === "23514") return fail("A card needs a title, text, or an image.");
    if (error.code === "23503") return fail("Choose a goal and life area from this workspace.");
    return fail("Could not save the card. Please try again.");
  }
  if (!data.length) return fail(NOT_FOUND);
  return ok();
}

/**
 * Points a card at an image the browser just uploaded. The path must be one this app would
 * create for this card, and the file must exist; the previous image (if any) is removed.
 */
export async function setCardImageInWorkspace(
  db: Db,
  workspaceId: string,
  cardId: string,
  path: string,
  alt: string | null,
): Promise<ActionResult> {
  if (!isCardImagePath(path, workspaceId, cardId)) return fail("That upload doesn't belong here.");
  const card = await loadCard(db, workspaceId, cardId);
  if (!card) return fail(NOT_FOUND);
  const folder = `${workspaceId}/${cardId}`;
  const name = path.slice(folder.length + 1);
  const { data: files, error: listError } = await db.storage
    .from(VISION_BUCKET)
    .list(folder, { search: name, limit: 10 });
  if (listError || !files?.some((f) => f.name === name)) {
    return fail("The image didn't finish uploading. Please try again.");
  }

  // Verify the file's actual content, not just its declared type (a renamed file can lie).
  const { data: blob, error: downloadError } = await db.storage.from(VISION_BUCKET).download(path);
  if (downloadError || !blob) {
    return fail("The image didn't finish uploading. Please try again.");
  }
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (!isSupportedImage(head)) {
    await removeFiles(db, [path]);
    return fail("That file isn't a supported image (JPEG, PNG, GIF, or WebP).");
  }

  const result = await updateCardInWorkspace(db, workspaceId, cardId, {
    image_path: path,
    image_alt: alt,
  });
  if (!result.ok) return result;
  if (card.image_path && card.image_path !== path) await removeFiles(db, [card.image_path]);
  return ok();
}

export async function removeCardImageInWorkspace(
  db: Db,
  workspaceId: string,
  cardId: string,
): Promise<ActionResult> {
  const card = await loadCard(db, workspaceId, cardId);
  if (!card) return fail(NOT_FOUND);
  if (!card.image_path) return ok();
  const result = await updateCardInWorkspace(db, workspaceId, cardId, {
    image_path: null,
    image_alt: null,
  });
  if (!result.ok) {
    return result.error.startsWith("A card needs")
      ? fail("Add a title or text before removing the image.")
      : result;
  }
  await removeFiles(db, [card.image_path]);
  return ok();
}

export async function deleteCardInWorkspace(
  db: Db,
  workspaceId: string,
  cardId: string,
): Promise<ActionResult> {
  const folder = `${workspaceId}/${cardId}`;
  const { data: files } = await db.storage.from(VISION_BUCKET).list(folder, { limit: 100 });
  const { data, error } = await db
    .from("vision_board_items")
    .delete()
    .eq("id", cardId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return fail("Could not delete the card.");
  if (!data.length) return fail(NOT_FOUND);
  // Every file in the card's folder: its image and any upload that never got attached.
  await removeFiles(
    db,
    (files ?? []).map((f) => `${folder}/${f.name}`),
  );
  return ok();
}

/**
 * Moves a card to just before `beforeId` (or to the end, with null) among the workspace's active
 * cards. Positions are relative to another card, so this works the same in a filtered view.
 */
export async function moveCardInWorkspace(
  db: Db,
  workspaceId: string,
  cardId: string,
  beforeId: string | null,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("vision_board_items")
    .select("id, sort_order")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (error) return fail("Could not reorder the board.");
  if (!data.some((c) => c.id === cardId)) return fail(NOT_FOUND);
  const ids = data.map((c) => c.id);
  const rest = ids.filter((id) => id !== cardId);
  const to = beforeId === null ? rest.length : rest.indexOf(beforeId);
  if (to < 0) return fail("Could not reorder the board. Refresh and try again.");
  const order = reorder(ids, cardId, to);
  const current = new Map(data.map((c) => [c.id, c.sort_order]));
  for (const [index, id] of order.entries()) {
    if (current.get(id) === index) continue;
    const { error: updateError } = await db
      .from("vision_board_items")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (updateError) return fail("Could not reorder the board.");
  }
  return ok();
}
