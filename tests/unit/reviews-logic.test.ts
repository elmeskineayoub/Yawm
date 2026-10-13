import { describe, expect, it } from "vitest";
import { aggregateHabitRates, ratePercent, REVIEW_FIELDS } from "@/features/reviews/logic";

describe("aggregateHabitRates", () => {
  it("sums done and due across habits and computes the overall rate", () => {
    const summary = aggregateHabitRates([
      { id: "a", title: "Read", done: 5, due: 7, rate: 5 / 7 },
      { id: "b", title: "Run", done: 3, due: 3, rate: 1 },
    ]);
    expect(summary.done).toBe(8);
    expect(summary.due).toBe(10);
    expect(summary.rate).toBeCloseTo(0.8);
    expect(summary.perHabit).toHaveLength(2);
  });

  it("is null, not zero, when nothing was scheduled", () => {
    expect(aggregateHabitRates([]).rate).toBeNull();
    expect(
      aggregateHabitRates([{ id: "a", title: "x", done: 0, due: 0, rate: null }]).rate,
    ).toBeNull();
  });
});

describe("ratePercent", () => {
  it("rounds a 0–1 rate to a percentage and passes null through", () => {
    expect(ratePercent(0.8)).toBe(80);
    expect(ratePercent(0.666)).toBe(67);
    expect(ratePercent(1)).toBe(100);
    expect(ratePercent(null)).toBeNull();
  });
});

describe("review fields", () => {
  it("has the four reflection prompts", () => {
    expect(REVIEW_FIELDS).toEqual(["went_well", "could_improve", "lessons", "next_focus"]);
  });
});
