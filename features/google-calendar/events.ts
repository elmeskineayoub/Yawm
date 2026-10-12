import type { EventWrite, GoogleEvent } from "./client";
import type { BlockSyncState, ExternalEvent } from "./types";

/**
 * Pure mapping and planning for Google sync, kept free of I/O so it can be unit tested.
 */

/**
 * The Google event ID for a block. Google accepts client-chosen IDs of base32hex characters
 * (a–v, 0–9); a UUID without dashes qualifies. Because the ID is fixed per block, a repeated or
 * retried insert can only ever hit the same event.
 */
export function eventIdForBlock(blockId: string): string {
  const id = blockId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error("Invalid block ID");
  return id;
}

export type SyncableBlock = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  updated_at: string;
};

/** Only what a calendar event needs: title and time. Notes and task details stay in Yawm. */
export function eventForBlock(block: SyncableBlock): EventWrite {
  return {
    id: eventIdForBlock(block.id),
    summary: block.title,
    start: { dateTime: new Date(block.starts_at).toISOString(), timeZone: block.timezone },
    end: { dateTime: new Date(block.ends_at).toISOString(), timeZone: block.timezone },
    status: "confirmed",
    transparency: "opaque",
    extendedProperties: { private: { yawmBlockId: block.id } },
  };
}

/** Google events for read-only display. Yawm's own events are skipped (the block is shown instead). */
export function toExternalEvents(events: GoogleEvent[], calendarName: string): ExternalEvent[] {
  return events.flatMap((e): ExternalEvent[] => {
    if (e.status === "cancelled" || e.extendedProperties?.private?.yawmBlockId) return [];
    const title =
      e.visibility === "private" || e.visibility === "confidential" || !e.summary?.trim()
        ? "Busy"
        : e.summary.trim().slice(0, 200);
    const free = e.transparency === "transparent";
    if (e.start?.dateTime && e.end?.dateTime) {
      const start = Date.parse(e.start.dateTime);
      const end = Date.parse(e.end.dateTime);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
      return [
        {
          id: e.id,
          title,
          calendarName,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          allDay: false,
          free,
        },
      ];
    }
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (e.start?.date && e.end?.date && iso.test(e.start.date) && iso.test(e.end.date)) {
      return [
        { id: e.id, title, calendarName, start: e.start.date, end: e.end.date, allDay: true, free },
      ];
    }
    return [];
  });
}

export type SyncRow = {
  id: string;
  time_block_id: string | null;
  calendar_id: string;
  event_id: string;
  status: BlockSyncState;
  block_updated_at: string | null;
};

export type SyncOp =
  | { kind: "delete"; row: SyncRow }
  | { kind: "update"; row: SyncRow; block: SyncableBlock }
  | { kind: "create"; block: SyncableBlock };

const sameInstant = (a: string | null, b: string) => a !== null && Date.parse(a) === Date.parse(b);

/**
 * What a sync run has to do, given the sync rows, the blocks they point at, and the blocks in the
 * sync window: deletes first, so removed blocks leave Google promptly, then changed blocks,
 * then blocks Google has not seen yet.
 */
export function planSync(
  rows: (SyncRow & { block: SyncableBlock | null })[],
  windowBlocks: SyncableBlock[],
  targetCalendarId: string,
): SyncOp[] {
  const deletes: SyncOp[] = [];
  const updates: SyncOp[] = [];
  const known = new Set<string>();
  for (const { block, ...row } of rows) {
    if (row.time_block_id) known.add(row.time_block_id);
    if (!row.time_block_id || !block) {
      deletes.push({ kind: "delete", row });
      continue;
    }
    const upToDate =
      row.status === "synced" &&
      row.calendar_id === targetCalendarId &&
      sameInstant(row.block_updated_at, block.updated_at);
    if (!upToDate) updates.push({ kind: "update", row, block });
  }
  const creates: SyncOp[] = windowBlocks
    .filter((b) => !known.has(b.id))
    .map((block) => ({ kind: "create", block }));
  return [...deletes, ...updates, ...creates];
}

/** Per-block state for the Planner: blocks with no work pending are synced. */
export function blockSyncStates(rows: SyncRow[], ops: SyncOp[]): Map<string, BlockSyncState> {
  const states = new Map<string, BlockSyncState>();
  for (const row of rows) if (row.time_block_id) states.set(row.time_block_id, "synced");
  for (const op of ops) {
    if (op.kind === "delete") continue;
    const failed = op.kind === "update" && op.row.status === "error";
    states.set(op.block.id, failed ? "error" : "pending");
  }
  return states;
}
