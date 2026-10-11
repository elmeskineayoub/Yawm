import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  const config = getSupabasePublicConfig();
  if (!config.configured) {
    throw new Error(`Supabase is not configured: ${config.problems.join(" ")}`);
  }
  return createBrowserClient<Database>(config.url, config.publishableKey);
}
