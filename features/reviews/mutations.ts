import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Db, Tables } from "@/lib/db/types";
import type { IsoDate } from "@/lib/dates";
import type { ReviewField } from "./logic";

// One review row per (workspace, week). Written field by field as the user types, using
// update-then-insert so the row is created on first edit without an upsert touching week_start
// or workspace_id (neither has an update grant).

export async function saveReviewFieldInWorkspace(
  db: Db,
  workspaceId: string,
  weekStart: IsoDate,
  field: ReviewField,
  value: string | null,
): Promise<ActionResult> {
  // `field` is a ReviewField (a known column), so a computed-key patch is safe to type here.
  const patch = { [field]: value } as Tables["weekly_reviews"]["Update"];
  const update = () =>
    db
      .from("weekly_reviews")
      .update(patch)
      .eq("workspace_id", workspaceId)
      .eq("week_start", weekStart)
      .select("id");

  const updated = await update();
  if (updated.error) return fail("Could not save the review.");
  if (updated.data.length) return ok();

  const inserted = await db.from("weekly_reviews").insert({
    workspace_id: workspaceId,
    week_start: weekStart,
    ...patch,
  } as Tables["weekly_reviews"]["Insert"]);
  if (inserted.error && inserted.error.code !== "23505") return fail("Could not save the review.");
  // A concurrent insert won the race; apply this field with an update.
  if (inserted.error) {
    const retry = await update();
    if (retry.error || !retry.data.length) return fail("Could not save the review.");
  }
  return ok();
}
