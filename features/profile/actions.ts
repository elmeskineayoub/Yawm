"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, toSaveState, type SaveState } from "@/lib/action-result";
import { fieldErrorsOf, formObject, optionalText } from "@/lib/form";
import { getWorkspaceContext } from "@/lib/workspace-context";

const profileSchema = z.object({
  display_name: optionalText(100),
  timezone: z.string().trim().min(1, "Choose a timezone.").max(64),
  week_start: z.coerce.number().int().min(0).max(6),
});

/**
 * Updates the caller's own profile. The database validates the timezone against IANA names.
 * Changing the timezone changes how existing times are shown, never the stored instants.
 */
export async function updateProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const parsed = profileSchema.safeParse(
    formObject(formData, ["display_name", "timezone", "week_start"]),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const { supabase, user } = await getWorkspaceContext();
  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select("id");
  if (error) {
    return error.code === "23514"
      ? {
          status: "error",
          message: "That timezone isn't recognised.",
          fieldErrors: { timezone: ["Choose a timezone from the list."] },
        }
      : { status: "error", message: "Could not save your settings. Please try again." };
  }
  if (!data.length) return toSaveState(fail("Your profile could not be found."));
  revalidatePath("/", "layout");
  return toSaveState(ok());
}
