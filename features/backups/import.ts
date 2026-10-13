import { z } from "zod";
import { EXPORT_SCHEMA_VERSION } from "./export";

/** Imports larger than this are refused before any work (REQUIREMENTS 11: guard expensive writes). */
export const IMPORT_MAX_BYTES = 25 * 1024 * 1024;

export const IMPORT_MODES = ["merge", "replace"] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

/** Shape validation only: the database re-validates every row's types when it loads them. */
export const importBundleSchema = z.object({
  app: z.string().optional(),
  schema_version: z.number(),
  exported_at: z.string().optional(),
  workspace: z.object({ id: z.string(), name: z.string() }).partial().optional(),
  records: z.record(z.string(), z.array(z.unknown())),
});

export type ImportSummary =
  | { ok: false; error: string }
  | {
      ok: true;
      schemaVersion: number;
      workspaceName: string | null;
      exportedAt: string | null;
      counts: { table: string; count: number }[];
      total: number;
    };

/** Validates a parsed file and summarises what a restore would contain (for the preview). */
export function summarizeImport(input: unknown): ImportSummary {
  const parsed = importBundleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This file isn't a valid Yawm backup." };
  const bundle = parsed.data;
  if (bundle.schema_version !== EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported backup version (${bundle.schema_version}).` };
  }
  const counts = Object.entries(bundle.records)
    .map(([table, rows]) => ({ table, count: rows.length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.table.localeCompare(b.table));
  return {
    ok: true,
    schemaVersion: bundle.schema_version,
    workspaceName: bundle.workspace?.name ?? null,
    exportedAt: bundle.exported_at ?? null,
    counts,
    total: counts.reduce((sum, c) => sum + c.count, 0),
  };
}
