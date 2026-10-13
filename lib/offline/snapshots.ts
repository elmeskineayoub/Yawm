import { snapshotsDb, type Snapshot } from "./db";
import {
  DEFAULT_SNAPSHOT_RETENTION,
  snapshotsToPrune,
  type SnapshotMeta,
  type SnapshotReason,
} from "./retention";

/** Snapshot metadata for a workspace, newest first (the heavy bundle is not loaded). */
export async function listSnapshots(workspaceId: string): Promise<SnapshotMeta[]> {
  const rows = await snapshotsDb().snapshots.where("workspaceId").equals(workspaceId).toArray();
  return rows
    .map((r) => ({ id: r.id!, createdAt: r.createdAt, reason: r.reason, size: r.size }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/** Stores a snapshot and prunes the workspace back to the retention limit. Returns the new id. */
export async function createSnapshot(
  workspaceId: string,
  reason: SnapshotReason,
  bundle: unknown,
): Promise<number> {
  const db = snapshotsDb();
  const snapshot: Snapshot = {
    workspaceId,
    createdAt: new Date().toISOString(),
    reason,
    size: JSON.stringify(bundle).length,
    bundle,
  };
  const id = await db.snapshots.add(snapshot);
  const stale = snapshotsToPrune(await listSnapshots(workspaceId), DEFAULT_SNAPSHOT_RETENTION);
  if (stale.length) await db.snapshots.bulkDelete(stale);
  return id;
}

export async function deleteSnapshot(id: number): Promise<void> {
  await snapshotsDb().snapshots.delete(id);
}

export async function getSnapshotBundle(id: number): Promise<unknown> {
  const row = await snapshotsDb().snapshots.get(id);
  return row?.bundle ?? null;
}
