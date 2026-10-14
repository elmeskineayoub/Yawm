"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { decryptSecret, tokenContext } from "./crypto";
import { loadConnectionRow, messageFor, updateConnection, withAccessToken } from "./connection";
import { createOAuthState, STATE_COOKIE, STATE_MAX_AGE_SECONDS } from "./oauth-state";
import { googleDepsFor } from "./queries";
import { syncConnection } from "./sync";
import type { SyncSummary } from "./types";

// Tokens and event content are never logged or returned to the client.

const NOT_AVAILABLE = "Google Calendar isn't configured on this server.";

/** Starts the OAuth flow. Form-submitted, so Next.js's server-action origin check applies. */
export async function connectGoogleCalendar(): Promise<void> {
  const ctx = await getWorkspaceContext();
  const deps = googleDepsFor(ctx);
  if (!deps) redirect("/settings?google=unavailable#google");
  const { state, codeChallenge, cookieValue } = createOAuthState(
    { userId: ctx.user.id, workspaceId: ctx.workspace.id },
    deps.config.stateKey,
  );
  (await cookies()).set(STATE_COOKIE, cookieValue, {
    httpOnly: true,
    // Lax still sends the cookie on Google's top-level redirect back to the callback.
    sameSite: "lax",
    secure: deps.config.redirectUri.startsWith("https://"),
    path: "/api/integrations/google-calendar",
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  redirect(deps.google.authorizeUrl({ state, codeChallenge }));
}

/** Deletes the stored tokens and asks Google to revoke them. Events already sent stay in Google. */
export async function disconnectGoogleCalendar(): Promise<ActionResult<{ revoked: boolean }>> {
  const ctx = await getWorkspaceContext();
  const deps = googleDepsFor(ctx);
  if (!deps) return fail(NOT_AVAILABLE);
  const conn = await loadConnectionRow(deps);
  if (!conn) return ok({ revoked: true });

  const refreshToken = decryptSecret(
    conn.refresh_token_ciphertext,
    deps.config.tokenKey,
    tokenContext(conn.workspace_id, conn.user_id, "refresh"),
  );
  // Revoke first, but delete local tokens no matter what Google says.
  const revoked = refreshToken ? await deps.google.revokeToken(refreshToken) : false;
  const { error } = await ctx.supabase
    .from("google_calendar_connections")
    .delete()
    .eq("id", conn.id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return fail("Could not disconnect Google Calendar. Try again.");
  revalidatePath("/", "layout");
  return ok({ revoked });
}

const calendarChoiceSchema = z.object({
  target: z.string().min(1).max(1024),
  show: z.array(z.string().min(1).max(1024)).max(10),
});

/** Chooses where blocks are written and whose events are shown. Checked against Google's list. */
export async function saveGoogleCalendars(input: {
  target: string;
  show: string[];
}): Promise<ActionResult> {
  const parsed = calendarChoiceSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a calendar to sync to.");
  const ctx = await getWorkspaceContext();
  const deps = googleDepsFor(ctx);
  if (!deps) return fail(NOT_AVAILABLE);
  const conn = await loadConnectionRow(deps);
  if (!conn) return fail("Connect Google Calendar first.");

  let owned;
  try {
    owned = (await withAccessToken(deps, conn, (token) => deps.google.listCalendars(token))).filter(
      (c) => c.accessRole === "owner",
    );
  } catch (error) {
    return fail(messageFor(error));
  }
  const target = owned.find((c) => c.id === parsed.data.target);
  if (!target) return fail("That calendar isn't one you own in Google Calendar.");
  const ownedIds = new Set(owned.map((c) => c.id));
  const show = [...new Set(parsed.data.show)].filter((id) => ownedIds.has(id));

  await updateConnection(deps, conn.id, {
    target_calendar_id: target.id,
    target_calendar_name: target.name,
    read_calendar_ids: show,
    // A new choice deserves a fresh attempt.
    status: "active",
    last_error: null,
  });
  revalidatePath("/", "layout");
  return ok();
}

/**
 * Pushes pending block changes to Google. `manual` ignores a rate-limit back-off; automatic runs
 * (after an edit, or when the Planner opens with pending work) respect it.
 */
export async function syncGoogleCalendar(manual = false): Promise<ActionResult<SyncSummary>> {
  const ctx = await getWorkspaceContext();
  const deps = googleDepsFor(ctx);
  if (!deps) return fail(NOT_AVAILABLE);

  // Sync calls the Google API; cap it per user (30 per 5 minutes) so it can't be hammered.
  const limit = await rateLimit(ctx.supabase, "google:sync", ctx.user.id, 30, 300);
  if (!limit.allowed) {
    return fail(`Syncing too often. Please wait ${Math.ceil(limit.retryAfter / 60)} minute(s).`);
  }

  const conn = await loadConnectionRow(deps);
  if (!conn) {
    return ok({
      pushed: 0,
      deleted: 0,
      failed: 0,
      remaining: 0,
      stopped: "not_connected",
      message: null,
    });
  }
  try {
    const summary = await syncConnection(deps, conn, { force: manual === true });
    revalidatePath("/", "layout");
    return ok(summary);
  } catch {
    return fail("Sync could not run. Your blocks are saved in Yawm; try again shortly.");
  }
}
