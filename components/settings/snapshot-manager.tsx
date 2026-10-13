"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { importWorkspace } from "@/features/backups/actions";
import {
  createSnapshot,
  deleteSnapshot,
  getSnapshotBundle,
  listSnapshots,
} from "@/lib/offline/snapshots";
import {
  needsDailySnapshot,
  type SnapshotMeta,
  type SnapshotReason,
} from "@/lib/offline/retention";

const REASON_LABELS: Record<SnapshotReason, string> = {
  daily: "Daily",
  manual: "Manual",
  "before-import": "Before import",
};

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

async function fetchBundle(): Promise<unknown> {
  const res = await fetch("/api/export?format=json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not read your workspace.");
  return res.json();
}

/** Automatic + manual browser-local snapshots, with retention and restore. */
export function SnapshotManager({
  workspaceId,
  today,
  timezone,
}: {
  workspaceId: string;
  today: string;
  timezone: string;
}) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const refresh = useCallback(async () => {
    setSnapshots(await listSnapshots(workspaceId));
  }, [workspaceId]);

  const take = useCallback(
    async (reason: SnapshotReason) => {
      setBusy(true);
      setStatus("Saving snapshot…");
      try {
        await createSnapshot(workspaceId, reason, await fetchBundle());
        await refresh();
        setStatus(`Snapshot saved ${new Date().toLocaleString()}`);
      } catch {
        setStatus("Could not save a snapshot in this browser.");
      } finally {
        setBusy(false);
      }
    },
    [workspaceId, refresh],
  );

  // On first mount: load existing snapshots and take today's automatic one if missing.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const existing = await listSnapshots(workspaceId);
        setSnapshots(existing);
        if (needsDailySnapshot(existing, today, timezone)) await take("daily");
      } catch {
        setStatus("Local snapshots aren't available in this browser.");
      }
    })();
  }, [workspaceId, today, timezone, take]);

  const download = async (meta: SnapshotMeta) => {
    const bundle = await getSnapshotBundle(meta.id);
    if (!bundle) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `yawm-snapshot-${meta.createdAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (id: number): Promise<string | null> => {
    const bundle = await getSnapshotBundle(id);
    if (!bundle) return "This snapshot could not be read.";
    const result = await importWorkspace(bundle, "replace");
    if (!result.ok) return result.error;
    toast.success(`Restored ${result.data.inserted} records from the snapshot.`);
    router.refresh();
    return null;
  };

  const remove = async (id: number) => {
    await deleteSnapshot(id);
    await refresh();
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Browser-local snapshots</p>
        <Button
          variant="secondary"
          className="py-1.5"
          disabled={busy}
          onClick={() => void take("manual")}
        >
          Snapshot now
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Automatic daily copies kept in this browser (newest 7). They can be lost if you clear site
        data — keep a downloaded backup too.
      </p>
      {status && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      )}

      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No snapshots in this browser yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {snapshots.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span>
                {new Date(s.createdAt).toLocaleString()}{" "}
                <span className="text-muted-foreground">
                  · {REASON_LABELS[s.reason]} · {formatSize(s.size)}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => void download(s)}
                >
                  Download
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" className="px-2 py-1 text-xs">
                      Restore
                    </Button>
                  }
                  title="Restore this snapshot?"
                  description={
                    <p>
                      This workspace&rsquo;s current data will be permanently replaced with the
                      snapshot from {new Date(s.createdAt).toLocaleString()}. This cannot be undone.
                    </p>
                  }
                  confirmLabel="Restore"
                  onConfirm={() => restore(s.id)}
                />
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  aria-label="Delete snapshot"
                  onClick={() => void remove(s.id)}
                >
                  Delete
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
