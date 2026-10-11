import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Create a new client per request (never cache it in module scope): it is bound to the
 * current request's cookies.
 */
export async function createClient() {
  // Read cookies first: it marks the caller as request-time rendering, so pages using this
  // client are never prerendered at build time (when Supabase settings may be absent).
  const cookieStore = await cookies();
  const config = getSupabasePublicConfig();
  if (!config.configured) {
    throw new Error(`Supabase is not configured: ${config.problems.join(" ")}`);
  }

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes
          // the session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
