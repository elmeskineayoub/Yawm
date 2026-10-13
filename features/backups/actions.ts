"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getWorkspaceContext } from "@/lib/workspace-context";
import type { Json } from "@/types/database";
import { EXPORT_SCHEMA_VERSION } from "./export";
import { importBundleSchema, IMPORT_MAX_BYTES, IMPORT_MODES, type ImportMode } from "./import";

// Restores a backup into the caller's active workspace. Validation runs before any write, and the
// database function does the whole import in one transaction, so a failure changes nothing.
export async function importWorkspace(
  payload: unknown,
  mode: string,
): Promise<ActionResult<{ inserted: number }>> {
  if (!(IMPORT_MODES as readonly string[]).includes(mode)) return fail("Choose replace or merge.");

  let size: number;
  try {
    size = JSON.stringify(payload).length;
  } catch {
    return fail("That file could not be read.");
  }
  if (size > IMPORT_MAX_BYTES) return fail("That backup is too large to import here.");

  const parsed = importBundleSchema.safeParse(payload);
  if (!parsed.success) return fail("This file isn't a valid Yawm backup.");
  if (parsed.data.schema_version !== EXPORT_SCHEMA_VERSION) {
    return fail(`Unsupported backup version (${parsed.data.schema_version}).`);
  }

  const { supabase, workspace } = await getWorkspaceContext();
  const { data, error } = await supabase.rpc("import_workspace", {
    target_workspace: workspace.id,
    payload: payload as Json,
    mode: mode as ImportMode,
  });
  if (error) {
    if (error.message.includes("BAD_SCHEMA_VERSION")) return fail("Unsupported backup version.");
    if (error.message.includes("FORBIDDEN")) return fail("You can't import into this workspace.");
    return fail("Could not import the backup. Nothing was changed.");
  }

  revalidatePath("/", "layout");
  const inserted =
    data && typeof data === "object" && "inserted" in data && typeof data.inserted === "number"
      ? data.inserted
      : 0;
  return ok({ inserted });
}
