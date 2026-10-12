"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { optionalText, optionalUuid } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import {
  createCardInWorkspace,
  deleteCardInWorkspace,
  moveCardInWorkspace,
  removeCardImageInWorkspace,
  setCardImageInWorkspace,
  updateCardInWorkspace,
} from "./mutations";

const uuid = z.uuid();
const invalid = () => fail("Invalid request.");

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const cardSchema = z.object({
  title: optionalText(120),
  body: optionalText(1000),
  area_id: optionalUuid,
  goal_id: optionalUuid,
  image_alt: optionalText(300),
});

export type CardFields = Partial<
  Record<"title" | "body" | "area_id" | "goal_id" | "image_alt", string | null>
>;

export async function createCard(input: CardFields): Promise<ActionResult<{ id: string }>> {
  const parsed = cardSchema.omit({ image_alt: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the card.");
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await createCardInWorkspace(supabase, workspace.id, parsed.data));
}

export async function updateCard(cardId: string, input: CardFields): Promise<ActionResult> {
  if (!uuid.safeParse(cardId).success) return invalid();
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the card.");
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await updateCardInWorkspace(supabase, workspace.id, cardId, parsed.data));
}

/** Called after the browser uploaded the file to the private bucket. */
export async function attachCardImage(
  cardId: string,
  path: string,
  alt: string | null,
): Promise<ActionResult> {
  const parsedAlt = optionalText(300).safeParse(alt);
  if (!uuid.safeParse(cardId).success || typeof path !== "string" || !parsedAlt.success) {
    return invalid();
  }
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await setCardImageInWorkspace(supabase, workspace.id, cardId, path, parsedAlt.data));
}

export async function removeCardImage(cardId: string): Promise<ActionResult> {
  if (!uuid.safeParse(cardId).success) return invalid();
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await removeCardImageInWorkspace(supabase, workspace.id, cardId));
}

export async function setCardArchived(cardId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(cardId).success) return invalid();
  const { supabase, workspace } = await getWorkspaceContext();
  return done(
    await updateCardInWorkspace(supabase, workspace.id, cardId, {
      archived_at: archived ? new Date().toISOString() : null,
    }),
  );
}

export async function deleteCard(cardId: string): Promise<ActionResult> {
  if (!uuid.safeParse(cardId).success) return invalid();
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await deleteCardInWorkspace(supabase, workspace.id, cardId));
}

/** Places a card just before another one (or at the end, with null). */
export async function moveCard(cardId: string, beforeId: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(cardId).success) return invalid();
  if (beforeId !== null && (!uuid.safeParse(beforeId).success || beforeId === cardId)) {
    return invalid();
  }
  const { supabase, workspace } = await getWorkspaceContext();
  return done(await moveCardInWorkspace(supabase, workspace.id, cardId, beforeId));
}

/** The browser needs the workspace ID to build the upload path (it is not a secret). */
export async function uploadTarget(): Promise<ActionResult<{ workspaceId: string }>> {
  const { workspace } = await getWorkspaceContext();
  return ok({ workspaceId: workspace.id });
}
