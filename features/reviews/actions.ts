"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { isIsoDate } from "@/lib/dates";
import { optionalText } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { REVIEW_FIELDS, type ReviewField } from "./logic";
import { saveReviewFieldInWorkspace } from "./mutations";

// Review text is personal reflection: never logged or sent anywhere but Supabase.

const valueSchema = optionalText(5000);

export async function saveReviewField(
  weekStart: string,
  field: ReviewField,
  value: string,
): Promise<ActionResult> {
  if (!isIsoDate(weekStart) || !REVIEW_FIELDS.includes(field)) return fail("Invalid request.");
  const parsed = valueSchema.safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);

  const { supabase, workspace } = await getWorkspaceContext();
  const result = await saveReviewFieldInWorkspace(
    supabase,
    workspace.id,
    weekStart,
    field,
    parsed.data,
  );
  if (!result.ok) return result;
  revalidatePath("/reviews");
  return ok();
}
