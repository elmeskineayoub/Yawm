import { cache } from "react";
import { requireUser } from "@/lib/auth/session";
import { todayIn, type IsoDate } from "@/lib/dates";
import { getCurrentWorkspace } from "@/lib/db/workspace";

/**
 * Everything a protected page or server action needs about the caller, resolved once per request.
 * The workspace is looked up on the server; client input never chooses it. RLS still has the
 * final say on every query.
 */
export const getWorkspaceContext = cache(async () => {
  const { supabase, user } = await requireUser();
  const [workspace, profile] = await Promise.all([
    getCurrentWorkspace(supabase, user.id),
    supabase.from("profiles").select("timezone, week_start").eq("id", user.id).maybeSingle(),
  ]);
  if (!workspace) throw new Error("Your personal workspace could not be found.");

  const timezone = profile.data?.timezone ?? "UTC";
  const today: IsoDate = todayIn(timezone);
  return {
    supabase,
    user,
    workspace,
    timezone,
    weekStart: profile.data?.week_start ?? 1,
    today,
  };
});

export type WorkspaceContext = Awaited<ReturnType<typeof getWorkspaceContext>>;
