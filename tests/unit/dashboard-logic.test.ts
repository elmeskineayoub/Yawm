import { describe, expect, it } from "vitest";
import { bucketByDay, completionRate, dailyPrompt } from "@/features/dashboard/logic";

describe("bucketByDay", () => {
  it("counts dates into contiguous daily buckets, oldest first", () => {
    const buckets = bucketByDay(
      ["2026-10-12", "2026-10-12", "2026-10-14", "2026-10-99-ignored" as string],
      "2026-10-12",
      3,
    );
    expect(buckets).toEqual([
      { date: "2026-10-12", count: 2 },
      { date: "2026-10-13", count: 0 },
      { date: "2026-10-14", count: 1 },
    ]);
  });

  it("ignores dates outside the window", () => {
    const buckets = bucketByDay(["2026-10-01", "2026-10-20"], "2026-10-12", 3);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
    expect(buckets).toHaveLength(3);
  });
});

describe("completionRate", () => {
  it("is done over the open-plus-done total, rounded", () => {
    expect(completionRate(3, 1)).toBe(75);
    expect(completionRate(2, 1)).toBe(67);
    expect(completionRate(5, 0)).toBe(100);
  });

  it("is null when nothing is done or open", () => {
    expect(completionRate(0, 0)).toBeNull();
  });
});

describe("dailyPrompt", () => {
  const prompts = ["a", "b", "c"];
  it("is stable for a given day and within range", () => {
    expect(dailyPrompt("2026-10-12", prompts)).toBe(dailyPrompt("2026-10-12", prompts));
    expect(prompts).toContain(dailyPrompt("2026-10-12", prompts));
  });

  it("rotates across consecutive days", () => {
    const a = dailyPrompt("2026-10-12", prompts);
    const b = dailyPrompt("2026-10-13", prompts);
    expect(a).not.toBe(b);
  });

  it("handles an empty prompt list", () => {
    expect(dailyPrompt("2026-10-12", [])).toBe("");
  });
});
