import { dateOfInstant, type IsoDate } from "@/lib/dates";

/**
 * Pure logic for browser-local snapshot retention (REQUIREMENTS 8.1–8.3), kept free of Dexie so it
 * is easy to test. Snapshots are a best-effort convenience stored in IndexedDB; the downloadable
 * export remains the real backup.
 */

export const DEFAULT_SNAPSHOT_RETENTION = 7;

export type SnapshotReason = "daily" | "manual" | "before-import";

export type SnapshotMeta = {
  id: number;
  createdAt: string;
  reason: SnapshotReason;
  size: number;
};

/** True when no snapshot was taken on the local calendar day `today` (at most one per day). */
export function needsDailySnapshot(
  snapshots: readonly SnapshotMeta[],
  today: IsoDate,
  timeZone: string,
): boolean {
  return !snapshots.some((s) => dateOfInstant(s.createdAt, timeZone) === today);
}

/** The ids of snapshots to delete so only the newest `keep` remain. */
export function snapshotsToPrune(
  snapshots: readonly SnapshotMeta[],
  keep: number = DEFAULT_SNAPSHOT_RETENTION,
): number[] {
  const sorted = [...snapshots].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
  );
  return sorted.slice(Math.max(0, keep)).map((s) => s.id);
}
