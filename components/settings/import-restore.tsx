"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { importWorkspace } from "@/features/backups/actions";
import { summarizeImport, type ImportMode, type ImportSummary } from "@/features/backups/import";
import { createSnapshot } from "@/lib/offline/snapshots";

/** Upload a JSON backup, preview what it contains, choose merge or replace, then restore it. */
export function ImportRestore({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<unknown>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");

  const onFile = async (file: File | undefined) => {
    setBundle(null);
    setSummary(null);
    if (!file) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setSummary({ ok: false, error: "That file isn't valid JSON." });
      return;
    }
    const result = summarizeImport(parsed);
    setSummary(result);
    if (result.ok) setBundle(parsed);
  };

  const run = async (): Promise<string | null> => {
    // A replace is destructive: snapshot the current workspace first (best-effort).
    if (mode === "replace") {
      try {
        const current = await (
          await fetch("/api/export?format=json", { cache: "no-store" })
        ).json();
        await createSnapshot(workspaceId, "before-import", current);
      } catch {
        // A failed local snapshot must not block the restore itself.
      }
    }
    const result = await importWorkspace(bundle, mode);
    if (!result.ok) return result.error;
    toast.success(
      `Imported ${result.data.inserted} record${result.data.inserted === 1 ? "" : "s"}.`,
    );
    setBundle(null);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
    return null;
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm font-medium">Restore from a backup</p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        aria-label="Backup file"
        onChange={(e) => void onFile(e.target.files?.[0])}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
      />

      {summary && !summary.ok && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {summary.error}
        </p>
      )}

      {summary?.ok && (
        <div className="rounded-md border border-border p-3 text-sm">
          <p>
            From workspace <span className="font-medium">{summary.workspaceName ?? "Unknown"}</span>
            {summary.exportedAt
              ? `, exported ${new Date(summary.exportedAt).toLocaleString()}`
              : ""}
            .
          </p>
          <p className="text-muted-foreground">
            {summary.total} record{summary.total === 1 ? "" : "s"} across {summary.counts.length}{" "}
            table{summary.counts.length === 1 ? "" : "s"}.
          </p>

          <fieldset className="mt-3 space-y-1">
            <legend className="sr-only">Import mode</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Merge</span> — add records that don&rsquo;t already
                exist; keep everything currently here.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Replace</span> — delete this workspace&rsquo;s data
                first, then restore the backup.
              </span>
            </label>
          </fieldset>

          <div className="mt-3">
            <ConfirmDialog
              trigger={
                <Button
                  className={
                    mode === "replace" ? "bg-red-700 text-white hover:bg-red-800" : undefined
                  }
                >
                  {mode === "replace" ? "Replace from backup" : "Merge backup"}
                </Button>
              }
              title={mode === "replace" ? "Replace this workspace?" : "Import this backup?"}
              description={
                <p>
                  {mode === "replace"
                    ? "Everything currently in this workspace — tasks, projects, notes, journal, habits, goals, and more — will be permanently deleted and replaced with the backup."
                    : "Records from the backup that don't already exist will be added. Records already here are kept unchanged."}{" "}
                  This cannot be undone.
                </p>
              }
              confirmLabel={mode === "replace" ? "Delete & replace" : "Import"}
              destructive={mode === "replace"}
              onConfirm={run}
            />
          </div>
        </div>
      )}
    </div>
  );
}
