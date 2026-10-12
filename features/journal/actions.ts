"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { buildJournalTemplate } from "./logic";
import {
  createEntryInWorkspace,
  deleteEntryInWorkspace,
  updateEntryInWorkspace,
} from "./mutations";
import { journalCreateSchema, journalSaveSchema } from "./schemas";

// Journal content is private (REQUIREMENTS 6.11, 11): never log it, never send it to Google,
// analytics, or any AI/third-party service. These actions only touch Supabase.

const uuid = z.uuid();

function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Creates a new entry for a date. When `fromPrompt` is "template" the body is seeded with the full
 * reflection template; a specific prompt seeds the entry with that single prompt.
 */
export async function createEntry(input: {
  entry_date: string;
  prompt?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = journalCreateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);

  const { entry_date, prompt } = parsed.data;
  const body = prompt === "__template__" ? buildJournalTemplate() : prompt ? `${prompt}\n\n` : null;
  const storedPrompt = prompt === "__template__" ? "Daily reflection" : prompt;

  const { supabase, workspace } = await getWorkspaceContext();
  const result = await createEntryInWorkspace(supabase, workspace.id, {
    entry_date,
    prompt: storedPrompt,
    body,
  });
  if (!result.ok) return result;
  refresh();
  return ok({ id: result.data.id });
}

/** Autosave of an entry's fields and tags. Returns the result; the editor shows the save state. */
export async function saveEntry(
  entryId: string,
  input: unknown,
  tagNames: string[],
): Promise<ActionResult> {
  if (!uuid.safeParse(entryId).success) return fail("Unknown entry.");
  const parsed = journalSaveSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  if (!Array.isArray(tagNames) || tagNames.some((t) => typeof t !== "string")) {
    return fail("Invalid tags.");
  }

  const { supabase, workspace } = await getWorkspaceContext();
  const result = await updateEntryInWorkspace(
    supabase,
    workspace.id,
    entryId,
    parsed.data,
    tagNames.slice(0, 50),
  );
  if (!result.ok) return result;
  refresh();
  return ok();
}

export async function deleteEntry(entryId: string): Promise<ActionResult> {
  if (!uuid.safeParse(entryId).success) return fail("Invalid request.");
  const { supabase, workspace } = await getWorkspaceContext();
  const result = await deleteEntryInWorkspace(supabase, workspace.id, entryId);
  if (!result.ok) return result;
  refresh();
  return ok();
}
