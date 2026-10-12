import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_SCOPES } from "@/features/google-calendar/config";
import { encryptSecret, tokenContext } from "@/features/google-calendar/crypto";
import { STATE_COOKIE, verifyOAuthState } from "@/features/google-calendar/oauth-state";
import { googleDepsFor } from "@/features/google-calendar/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

/**
 * Google's redirect back after consent. Accepted only with a valid, unexpired, single-use state
 * bound to this browser, user, and workspace. Always redirects to a fixed Settings URL (never to
 * a URL taken from the request), and never puts tokens in a URL or log.
 */
export const dynamic = "force-dynamic";

type Outcome =
  "connected" | "denied" | "state" | "scopes" | "no_refresh" | "taken" | "failed" | "unavailable";

function back(request: NextRequest, outcome: Outcome) {
  const url = new URL("/settings", request.nextUrl.origin);
  url.searchParams.set("google", outcome);
  url.hash = "google";
  const response = NextResponse.redirect(url, { status: 303 });
  // Single use: clear the state cookie whatever happened.
  response.cookies.set(STATE_COOKIE, "", {
    path: "/api/integrations/google-calendar",
    maxAge: 0,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceContext();
  const deps = googleDepsFor(ctx);
  if (!deps) return back(request, "unavailable");

  const params = request.nextUrl.searchParams;
  const check = verifyOAuthState(
    request.cookies.get(STATE_COOKIE)?.value,
    params.get("state"),
    { userId: ctx.user.id, workspaceId: ctx.workspace.id },
    deps.config.stateKey,
  );
  if (!check.ok) return back(request, "state");
  if (params.get("error")) return back(request, "denied");
  const code = params.get("code");
  if (!code) return back(request, "failed");

  let grant;
  try {
    grant = await deps.google.exchangeCode(code, check.verifier);
  } catch {
    return back(request, "failed");
  }
  // Google's consent screen lets people untick scopes; without both, sync can't work.
  if (!GOOGLE_SCOPES.every((scope) => grant.scopes.includes(scope))) {
    await deps.google.revokeToken(grant.accessToken);
    return back(request, "scopes");
  }
  if (!grant.refreshToken) {
    await deps.google.revokeToken(grant.accessToken);
    return back(request, "no_refresh");
  }

  // The primary calendar's ID is the account's address: shown as "Connected as …".
  let primary: { id: string; name: string } | null = null;
  try {
    const calendars = await deps.google.listCalendars(grant.accessToken);
    primary = calendars.find((c) => c.primary) ?? null;
  } catch {
    // Not fatal: the user can pick a calendar in Settings.
  }

  const owner = { workspaceId: ctx.workspace.id, userId: ctx.user.id };
  const existing = await ctx.supabase
    .from("google_calendar_connections")
    .select("id, target_calendar_id, target_calendar_name, read_calendar_ids")
    .eq("workspace_id", owner.workspaceId)
    .eq("user_id", owner.userId)
    .maybeSingle();
  const tokens = {
    google_account_email: primary?.id.slice(0, 320) ?? null,
    refresh_token_ciphertext: encryptSecret(
      grant.refreshToken,
      deps.config.tokenKey,
      tokenContext(owner.workspaceId, owner.userId, "refresh"),
    ),
    access_token_ciphertext: encryptSecret(
      grant.accessToken,
      deps.config.tokenKey,
      tokenContext(owner.workspaceId, owner.userId, "access"),
    ),
    access_token_expires_at: new Date(grant.expiresAt).toISOString(),
    scopes: grant.scopes,
    status: "active" as const,
    last_error: null,
    retry_after: null,
  };

  const write = existing.data
    ? await ctx.supabase
        .from("google_calendar_connections")
        .update({
          ...tokens,
          // Keep the earlier calendar choice when reconnecting.
          target_calendar_id: existing.data.target_calendar_id ?? primary?.id ?? null,
          target_calendar_name: existing.data.target_calendar_name ?? primary?.name ?? null,
          read_calendar_ids: existing.data.read_calendar_ids.length
            ? existing.data.read_calendar_ids
            : primary
              ? [primary.id]
              : [],
        })
        .eq("id", existing.data.id)
        .eq("workspace_id", owner.workspaceId)
    : await ctx.supabase.from("google_calendar_connections").insert({
        workspace_id: owner.workspaceId,
        user_id: owner.userId,
        ...tokens,
        target_calendar_id: primary?.id ?? null,
        target_calendar_name: primary?.name ?? null,
        read_calendar_ids: primary ? [primary.id] : [],
      });

  if (write.error) {
    await deps.google.revokeToken(grant.refreshToken);
    // 23505: another member already connected this workspace.
    return back(request, write.error.code === "23505" ? "taken" : "failed");
  }
  return back(request, "connected");
}
