import { describe, expect, it } from "vitest";
import { summarizeImport } from "@/features/backups/import";

const valid = {
  app: "Yawm",
  schema_version: 1,
  exported_at: "2026-10-13T00:00:00Z",
  workspace: { id: "w1", name: "Personal" },
  records: {
    tasks: [{ id: "t1" }, { id: "t2" }],
    notes: [{ id: "n1" }],
    areas: [],
  },
};

describe("summarizeImport", () => {
  it("summarises a valid backup with per-table counts (empty tables dropped, sorted)", () => {
    const result = summarizeImport(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspaceName).toBe("Personal");
    expect(result.exportedAt).toBe("2026-10-13T00:00:00Z");
    expect(result.total).toBe(3);
    expect(result.counts).toEqual([
      { table: "notes", count: 1 },
      { table: "tasks", count: 2 },
    ]);
  });

  it("rejects a file that isn't a backup", () => {
    expect(summarizeImport({ hello: "world" })).toEqual({
      ok: false,
      error: "This file isn't a valid Yawm backup.",
    });
    expect(summarizeImport(null).ok).toBe(false);
  });

  it("rejects an unsupported schema version", () => {
    const result = summarizeImport({ ...valid, schema_version: 99 });
    expect(result).toEqual({ ok: false, error: "Unsupported backup version (99)." });
  });
});
