import "server-only";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { GoogleApiError, googleClient, type GoogleCalendar } from "./client";
import { getGoogleConfig, type GoogleConfigResult } from "./config";
import {
  loadConnectionRow,
  messageFor,
  withAccessToken,
  type ConnectionRow,
  type GoogleDeps,
} from "./connection";
import { blockSyncStates, toExternalEvents } from "./events";
import { loadSyncPlan } from "./sync";
import type { BlockSyncState, ExternalEvent, GoogleConnectionState } from "./types";

/** Google dependencies for the signed-in user, or null when the integration is off. */
export function googleDepsFor(
  ctx: Pick<WorkspaceContext, "supabase" | "workspace" | "user">,
  result: GoogleConfigResult = getGoogleConfig(),
): GoogleDeps | null {
  if (!result.enabled) return null;
  return {
    db: ctx.supabase,
    workspaceId: ctx.workspace.id,
    userId: ctx.user.id,
    config: result.config,
    google: googleClient(result.config),
  };
}

function connectedState(
  conn: ConnectionRow,
  counts: { pending: number; failed: number },
): GoogleConnectionState {
  return {
    available: true,
    connected: true,
    status: conn.status,
    email: conn.google_account_email,
    targetCalendarId: conn.target_calendar_id,
    targetCalendarName: conn.target_calendar_name,
    readCalendarIds: conn.read_calendar_ids,
    lastSyncedAt: conn.last_synced_at,
    lastError: conn.last_error,
    retryAfter: conn.retry_after,
    ...counts,
  };
}

export type GoogleOverview = {
  state: GoogleConnectionState;
  blockStates: Map<string, BlockSyncState>;
  deps: GoogleDeps | null;
  conn: ConnectionRow | null;
};

/** Connection state and per-block sync state. No Google request is made. */
export async function loadGoogleOverview(ctx: WorkspaceContext): Promise<GoogleOverview> {
  const config = getGoogleConfig();
  const deps = googleDepsFor(ctx, config);
  if (!config.enabled || !deps) {
    const state: GoogleConnectionState = config.enabled
      ? { available: false, reason: "misconfigured", problems: [] }
      : { available: false, reason: config.reason, problems: config.problems };
    return { state, blockStates: new Map(), deps: null, conn: null };
  }
  const conn = await loadConnectionRow(deps);
  if (!conn) {
    return { state: { available: true, connected: false }, blockStates: new Map(), deps, conn };
  }
  const { rows, ops } = await loadSyncPlan(deps, conn);
  const blockStates = blockSyncStates(rows, ops);
  const failed = [...blockStates.values()].filter((s) => s === "error").length;
  return {
    state: connectedState(conn, { pending: ops.length - failed, failed }),
    blockStates,
    deps,
    conn,
  };
}

const MAX_READ_CALENDARS = 10;

/**
 * Google events in [start, end) from the calendars the user chose to show. Failures never break
 * the Planner: they come back as a message and an empty list.
 */
export async function loadGoogleEvents(
  overview: GoogleOverview,
  range: { start: string; end: string },
): Promise<{ events: ExternalEvent[]; error: string | null }> {
  const { deps, conn } = overview;
  if (!deps || !conn || conn.status === "reconnect_required") return { events: [], error: null };
  const calendarIds = conn.read_calendar_ids.slice(0, MAX_READ_CALENDARS);
  if (!calendarIds.length) return { events: [], error: null };
  try {
    const lists = await withAccessToken(deps, conn, (token) =>
      Promise.all(
        calendarIds.map((id) =>
          deps.google.listEvents(token, id, { timeMin: range.start, timeMax: range.end }),
        ),
      ),
    );
    const events = lists.flatMap((list, i) => {
      const id = calendarIds[i]!;
      const name = id === conn.target_calendar_id ? (conn.target_calendar_name ?? id) : id;
      return toExternalEvents(list, name);
    });
    return { events, error: null };
  } catch (error) {
    return {
      events: [],
      error:
        error instanceof GoogleApiError && error.kind === "not_found"
          ? "A calendar you chose to show is no longer available. Update your choice in Settings."
          : `Google events couldn't be loaded. ${messageFor(error)}`,
    };
  }
}

/** Calendars the user owns: the only ones this app's scopes can read events from or write to. */
export async function loadOwnedCalendars(
  overview: GoogleOverview,
): Promise<{ calendars: GoogleCalendar[]; error: string | null }> {
  const { deps, conn } = overview;
  if (!deps || !conn || conn.status === "reconnect_required") return { calendars: [], error: null };
  try {
    const all = await withAccessToken(deps, conn, (token) => deps.google.listCalendars(token));
    return { calendars: all.filter((c) => c.accessRole === "owner"), error: null };
  } catch (error) {
    return { calendars: [], error: messageFor(error) };
  }
}
