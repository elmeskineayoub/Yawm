import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/**
 * Server-side guard for protected pages. The proxy already redirects signed-out requests; this
 * re-checks so pages never rely on the proxy alone.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user: SessionUser = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
  return { supabase, user };
}
