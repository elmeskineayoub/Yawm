import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Db = SupabaseClient<Database>;
export type Tables = Database["public"]["Tables"];
