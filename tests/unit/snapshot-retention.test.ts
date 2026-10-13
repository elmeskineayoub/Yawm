import { describe, expect, it } from "vitest";
import { needsDailySnapshot, snapshotsToPrune, type SnapshotMeta } from "@/lib/offline/retention";

const snap = (id: number, createdAt: string): SnapshotMeta => ({
  id,
  createdAt,
  reason: "daily",
  size: 100,
});

describe("needsDailySnapshot", () => {
  it("is false when a snapshot already exists for today in the user's timezone", () => {
    const snaps = [snap(1, "2026-10-13T06:00:00Z")];
    expect(needsDailySnapshot(snaps, "2026-10-13", "UTC")).toBe(false);
    expect(needsDailySnapshot(snaps, "2026-10-14", "UTC")).toBe(true);
    expect(needsDailySnapshot([], "2026-10-13", "UTC")).toBe(true);
  });

  it("uses the local calendar day, not UTC", () => {
    // 23:30 UTC on the 13th is already the 14th in Tokyo.
    const snaps = [snap(1, "2026-10-13T23:30:00Z")];
    expect(needsDailySnapshot(snaps, "2026-10-14", "Asia/Tokyo")).toBe(false);
  });
});

describe("snapshotsToPrune", () => {
  it("keeps the newest N and returns the rest, newest-first tie-break by id", () => {
    const snaps = [
      snap(1, "2026-10-10T00:00:00Z"),
      snap(2, "2026-10-11T00:00:00Z"),
      snap(3, "2026-10-12T00:00:00Z"),
    ];
    expect(snapshotsToPrune(snaps, 2)).toEqual([1]);
    expect(snapshotsToPrune(snaps, 3)).toEqual([]);
    expect(snapshotsToPrune(snaps, 0)).toEqual([3, 2, 1]);
  });
});
