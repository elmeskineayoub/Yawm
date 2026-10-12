import "server-only";
import { GoogleApiError, type EventWrite, type GoogleClient } from "./client";
import {
  GOOGLE_MESSAGES,
  messageFor,
  updateConnection,
  withAccessToken,
  type ConnectionRow,
  type GoogleDeps,
} from "./connection";
import {
  eventForBlock,
  eventIdForBlock,
  planSync,
  type SyncableBlock,
  type SyncOp,
  type SyncRow,
} from "./events";
import type { SyncSummary } from "./types";

/**
 * One-way sync of app time blocks to the connected Google calendar.
 *
 * Idempotency: every block maps to one fixed Google event ID. Creating inserts with that ID
 * (a retry gets "already exists" and becomes an update), updating writes the full event, and
 * deleting treats "already gone" as success. A run can be interrupted at any point and
 * repeated; it converges without duplicates. Changes are detected by comparing each block's
 * `updated_at` with the version last pushed, so nothing has to be queued when a block changes.
 */

/** Blocks that ended more than this long ago are not sent unless they were synced before. */
const WINDOW_PAST_DAYS = 7;
/** Google requests per run, so a server action stays fast. */
export const SYNC_BATCH = 25;

const blockColumns = "id, title, starts_at, ends_at, timezone, updated_at";

export async function loadSyncPlan(deps: GoogleDeps, conn: ConnectionRow) {
  const since = new Date((deps.now?.() ?? Date.now()) - WINDOW_PAST_DAYS * 86_400_000);
  const [rows, blocks] = await Promise.all([
    deps.db
      .from("time_block_sync")
      .select(
        `id, time_block_id, calendar_id, event_id, status, block_updated_at, block:time_blocks(${blockColumns})`,
      )
      .eq("workspace_id", deps.workspaceId)
      .eq("connection_id", conn.id)
      .limit(5000),
    deps.db
      .from("time_blocks")
      .select(blockColumns)
      .eq("workspace_id", deps.workspaceId)
      .eq("origin", "app")
      .gte("ends_at", since.toISOString())
      .order("starts_at")
      .limit(1000),
  ]);
  if (rows.error || blocks.error) throw new Error("Could not load sync state.");
  const syncRows = rows.data.map((r) => ({ ...r, block: r.block as SyncableBlock | null }));
  const ops = conn.target_calendar_id
    ? planSync(syncRows, blocks.data, conn.target_calendar_id)
    : [];
  return { rows: syncRows as (SyncRow & { block: SyncableBlock | null })[], ops };
}

const isKind = (error: unknown, kind: GoogleApiError["kind"]) =>
  error instanceof GoogleApiError && error.kind === kind;

/** Writes the event whether or not Google already has it. */
async function putEvent(
  google: GoogleClient,
  token: string,
  calendarId: string,
  event: EventWrite,
  probablyExists: boolean,
) {
  if (probablyExists) {
    try {
      return await google.updateEvent(token, calendarId, event);
    } catch (error) {
      if (!isKind(error, "not_found")) throw error;
    }
  }
  try {
    await google.insertEvent(token, calendarId, event);
  } catch (error) {
    if (!isKind(error, "conflict")) throw error;
    // The ID is taken: an earlier attempt (or a deleted copy) exists. Overwrite it.
    await google.updateEvent(token, calendarId, event);
  }
}

async function runOp(deps: GoogleDeps, conn: ConnectionRow, op: SyncOp, target: string) {
  const sync = deps.db.from("time_block_sync");
  const syncedAt = new Date(deps.now?.() ?? Date.now()).toISOString();

  if (op.kind === "delete") {
    await withAccessToken(deps, conn, (token) =>
      deps.google.deleteEvent(token, op.row.calendar_id, op.row.event_id),
    );
    const { error } = await sync.delete().eq("id", op.row.id).eq("workspace_id", deps.workspaceId);
    if (error) throw new Error("Could not update sync state.");
    return;
  }

  const event = eventForBlock(op.block);
  const done = {
    status: "synced" as const,
    last_error: null,
    block_updated_at: op.block.updated_at,
    synced_at: syncedAt,
    attempts: 0,
    calendar_id: target,
  };

  if (op.kind === "update") {
    const moved = op.row.calendar_id !== target;
    await withAccessToken(deps, conn, async (token) => {
      // The target calendar changed: remove the copy from the old one first.
      if (moved) await deps.google.deleteEvent(token, op.row.calendar_id, op.row.event_id);
      await putEvent(deps.google, token, target, event, !moved && op.row.block_updated_at !== null);
    });
    const { error } = await sync
      .update(done)
      .eq("id", op.row.id)
      .eq("workspace_id", deps.workspaceId);
    if (error) throw new Error("Could not update sync state.");
    return;
  }

  // Record the intent before calling Google, so an interrupted run is picked up as an update.
  const { error: insertError } = await sync.upsert(
    {
      workspace_id: deps.workspaceId,
      connection_id: conn.id,
      time_block_id: op.block.id,
      calendar_id: target,
      event_id: eventIdForBlock(op.block.id),
      status: "pending",
    },
    { onConflict: "time_block_id", ignoreDuplicates: true },
  );
  if (insertError) throw new Error("Could not update sync state.");
  await withAccessToken(deps, conn, (token) => putEvent(deps.google, token, target, event, false));
  const { error } = await sync
    .update(done)
    .eq("time_block_id", op.block.id)
    .eq("workspace_id", deps.workspaceId);
  if (error) throw new Error("Could not update sync state.");
}

async function markOpFailed(deps: GoogleDeps, op: SyncOp, message: string) {
  const sync = deps.db.from("time_block_sync").update({ status: "error", last_error: message });
  const query =
    op.kind === "create" ? sync.eq("time_block_id", op.block.id) : sync.eq("id", op.row.id);
  await query.eq("workspace_id", deps.workspaceId);
}

export type SyncOptions = {
  /** Ignore a rate-limit back-off (the user pressed "Sync now"). */
  force?: boolean;
  limit?: number;
};

export async function syncConnection(
  deps: GoogleDeps,
  conn: ConnectionRow,
  { force = false, limit = SYNC_BATCH }: SyncOptions = {},
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    pushed: 0,
    deleted: 0,
    failed: 0,
    remaining: 0,
    stopped: null,
    message: null,
  };
  const nowMs = deps.now?.() ?? Date.now();
  if (conn.status === "reconnect_required") {
    return {
      ...summary,
      stopped: "reconnect",
      message: conn.last_error ?? GOOGLE_MESSAGES.reconnect,
    };
  }
  const target = conn.target_calendar_id;
  if (!target) {
    return { ...summary, stopped: "no_target", message: "Choose a calendar to sync to." };
  }
  if (!force && conn.retry_after && Date.parse(conn.retry_after) > nowMs) {
    return { ...summary, stopped: "rate_limited", message: GOOGLE_MESSAGES.rateLimited };
  }

  const { ops } = await loadSyncPlan(deps, conn);
  const batch = ops.slice(0, limit);
  let attempted = 0;
  let retryAfter: string | null = null;

  for (const op of batch) {
    attempted++;
    try {
      await runOp(deps, conn, op, target);
      if (op.kind === "delete") summary.deleted++;
      else summary.pushed++;
    } catch (error) {
      const message = messageFor(error);
      if (isKind(error, "revoked")) {
        // withAccessToken has already marked the connection.
        summary.stopped = "reconnect";
        summary.message = conn.last_error ?? message;
        attempted--;
        break;
      }
      summary.failed++;
      await markOpFailed(deps, op, message);
      if (isKind(error, "rate_limited")) {
        const seconds = (error as GoogleApiError).retryAfterSeconds ?? 60;
        retryAfter = new Date(nowMs + seconds * 1000).toISOString();
        summary.stopped = "rate_limited";
        summary.message = message;
        break;
      }
      if (isKind(error, "forbidden")) {
        summary.stopped = "forbidden";
        summary.message = message;
        break;
      }
      summary.message = message;
    }
  }
  summary.remaining = ops.length - attempted;

  if (summary.stopped !== "reconnect") {
    await updateConnection(deps, conn.id, {
      status: summary.stopped === "forbidden" ? "error" : "active",
      last_error: summary.failed || summary.stopped ? summary.message : null,
      retry_after: retryAfter,
      ...(summary.failed === 0 && !summary.stopped
        ? { last_synced_at: new Date(nowMs).toISOString() }
        : {}),
    });
  }
  return summary;
}
