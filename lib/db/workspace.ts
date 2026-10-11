import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type CurrentWorkspace = Pick<
  Database["public"]["Tables"]["workspaces"]["Row"],
  "id" | "name" | "is_personal"
>;

/**
 * The workspace the app operates in. Until workspace switching exists this is the user's
 * personal workspace. RLS still decides what the query may return.
 */
export async function getCurrentWorkspace(
  supabase: Client,
  userId: string,
): Promise<CurrentWorkspace | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, is_personal")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .maybeSingle();
  if (error) throw new Error("Could not load your workspace.");
  return data;
}

export async function listActiveAreas(supabase: Client, workspaceId: string) {
  const { data, error } = await supabase
    .from("areas")
    .select("id, name, color")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("sort_order")
    .order("name");
  if (error) throw new Error("Could not load your life areas.");
  return data;
}
