import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { GoogleApiError, type GoogleClient } from "./client";
import type { GoogleConfig } from "./config";
import { decryptSecret, encryptSecret, tokenContext } from "./crypto";

/**
 * Server-side access to the stored Google connection. Every query uses the signed-in user's
 * Supabase session, so RLS limits it to the user's own connection in the active workspace.
 * Decrypted tokens exist only in memory for the duration of a request.
 */

export type Db = SupabaseClient<Database>;
export type ConnectionRow = Database["public"]["Tables"]["google_calendar_connections"]["Row"];

export type GoogleDeps = {
  db: Db;
  workspaceId: string;
  userId: string;
  config: GoogleConfig;
  google: GoogleClient;
  now?: () => number;
};

/** Short, user-facing messages. They never include tokens or event content. */
export const GOOGLE_MESSAGES = {
  reconnect: "Google Calendar access was revoked or expired. Reconnect to resume syncing.",
  undecryptable:
    "Stored Google credentials can't be read (the encryption key changed). Reconnect Google Calendar.",
  rateLimited: "Google Calendar is rate-limiting requests. Sync will resume shortly.",
  forbidden:
    "Google Calendar refused access to this calendar. Choose another calendar or reconnect and allow calendar access.",
  unavailable: "Google Calendar couldn't be reached. Your blocks are saved and will sync later.",
  invalid: "Google Calendar rejected the request. Your blocks are saved in Yawm.",
} as const;

export function messageFor(error: unknown): string {
  if (!(error instanceof GoogleApiError)) return GOOGLE_MESSAGES.unavailable;
  switch (error.kind) {
    case "revoked":
    case "unauthorized":
      return GOOGLE_MESSAGES.reconnect;
    case "rate_limited":
      return GOOGLE_MESSAGES.rateLimited;
    case "forbidden":
      return GOOGLE_MESSAGES.forbidden;
    case "unavailable":
      return GOOGLE_MESSAGES.unavailable;
    default:
      return GOOGLE_MESSAGES.invalid;
  }
}

const now = (deps: GoogleDeps) => deps.now?.() ?? Date.now();

/** The full row, ciphertext included. Server-only: never pass this to a client component. */
export async function loadConnectionRow(deps: GoogleDeps): Promise<ConnectionRow | null> {
  const { data, error } = await deps.db
    .from("google_calendar_connections")
    .select("*")
    .eq("workspace_id", deps.workspaceId)
    .eq("user_id", deps.userId)
    .maybeSingle();
  if (error) throw new Error("Could not load the Google Calendar connection.");
  return data;
}

export async function updateConnection(
  deps: GoogleDeps,
  connectionId: string,
  patch: Database["public"]["Tables"]["google_calendar_connections"]["Update"],
) {
  const { error } = await deps.db
    .from("google_calendar_connections")
    .update(patch)
    .eq("id", connectionId)
    .eq("workspace_id", deps.workspaceId);
  if (error) throw new Error("Could not update the Google Calendar connection.");
}

/** Marks the connection as needing the user's attention; stops automatic sync. */
export async function markNeedsReconnect(deps: GoogleDeps, conn: ConnectionRow, message: string) {
  const patch = {
    status: "reconnect_required" as const,
    last_error: message,
    access_token_ciphertext: null,
    access_token_expires_at: null,
  };
  await updateConnection(deps, conn.id, patch);
  Object.assign(conn, patch);
}

const EXPIRY_MARGIN_MS = 60_000;

async function freshAccessToken(deps: GoogleDeps, conn: ConnectionRow): Promise<string> {
  const refreshToken = decryptSecret(
    conn.refresh_token_ciphertext,
    deps.config.tokenKey,
    tokenContext(conn.workspace_id, conn.user_id, "refresh"),
  );
  if (!refreshToken) {
    await markNeedsReconnect(deps, conn, GOOGLE_MESSAGES.undecryptable);
    throw new GoogleApiError("revoked", null);
  }
  let grant;
  try {
    grant = await deps.google.refreshAccessToken(refreshToken);
  } catch (error) {
    if (error instanceof GoogleApiError && error.kind === "revoked") {
      await markNeedsReconnect(deps, conn, GOOGLE_MESSAGES.reconnect);
    }
    throw error;
  }
  const patch = {
    access_token_ciphertext: encryptSecret(
      grant.accessToken,
      deps.config.tokenKey,
      tokenContext(conn.workspace_id, conn.user_id, "access"),
    ),
    access_token_expires_at: new Date(grant.expiresAt).toISOString(),
    // Google may rotate the refresh token; keep the newest one.
    ...(grant.refreshToken
      ? {
          refresh_token_ciphertext: encryptSecret(
            grant.refreshToken,
            deps.config.tokenKey,
            tokenContext(conn.workspace_id, conn.user_id, "refresh"),
          ),
        }
      : {}),
  };
  await updateConnection(deps, conn.id, patch);
  Object.assign(conn, patch);
  return grant.accessToken;
}

async function accessToken(deps: GoogleDeps, conn: ConnectionRow): Promise<string> {
  const expiresAt = conn.access_token_expires_at ? Date.parse(conn.access_token_expires_at) : 0;
  if (conn.access_token_ciphertext && expiresAt - EXPIRY_MARGIN_MS > now(deps)) {
    const token = decryptSecret(
      conn.access_token_ciphertext,
      deps.config.tokenKey,
      tokenContext(conn.workspace_id, conn.user_id, "access"),
    );
    if (token) return token;
  }
  return freshAccessToken(deps, conn);
}

/**
 * Runs a Google request with a valid access token. A rejected access token is refreshed once and
 * the request retried; if Google still says no, the connection is marked for reconnecting.
 */
export async function withAccessToken<T>(
  deps: GoogleDeps,
  conn: ConnectionRow,
  request: (token: string) => Promise<T>,
): Promise<T> {
  if (conn.status === "reconnect_required") throw new GoogleApiError("revoked", null);
  const token = await accessToken(deps, conn);
  try {
    return await request(token);
  } catch (error) {
    if (!(error instanceof GoogleApiError) || error.kind !== "unauthorized") throw error;
  }
  const retryToken = await freshAccessToken(deps, conn);
  try {
    return await request(retryToken);
  } catch (error) {
    if (error instanceof GoogleApiError && error.kind === "unauthorized") {
      await markNeedsReconnect(deps, conn, GOOGLE_MESSAGES.reconnect);
      throw new GoogleApiError("revoked", error.status);
    }
    throw error;
  }
}
