import Dexie, { type Table } from "dexie";
import type { SnapshotReason } from "./retention";

/**
 * Browser-local snapshot store (IndexedDB via Dexie). This is a recovery convenience, never a
 * source of truth: Supabase is canonical, and the downloadable export is the real backup. Clearing
 * site data or losing the device removes these snapshots.
 */
export type Snapshot = {
  id?: number;
  workspaceId: string;
  createdAt: string;
  reason: SnapshotReason;
  size: number;
  /** The full export bundle JSON (same shape the server produces). */
  bundle: unknown;
};

class YawmDb extends Dexie {
  snapshots!: Table<Snapshot, number>;

  constructor() {
    super("yawm");
    this.version(1).stores({ snapshots: "++id, workspaceId, createdAt" });
  }
}

// Constructed lazily and only in the browser, so server rendering never touches IndexedDB.
let instance: YawmDb | null = null;

export function snapshotsDb(): YawmDb {
  if (typeof window === "undefined") {
    throw new Error("Local snapshots are only available in the browser.");
  }
  instance ??= new YawmDb();
  return instance;
}
