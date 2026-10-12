import { describe, expect, it } from "vitest";
import {
  goalProgress,
  isGoalOverdue,
  measureOf,
  nextMilestone,
  type MilestoneLike,
} from "@/features/goals/logic";

const m = (id: string, fields: Partial<MilestoneLike> = {}): MilestoneLike => ({
  id,
  title: id,
  due_date: null,
  completed_at: null,
  sort_order: 0,
  ...fields,
});

describe("goal progress", () => {
  it("reports milestones, the measurable target, and work separately", () => {
    const progress = goalProgress(
      { target_value: 24, current_value: 6, unit: "books" },
      [m("a", { completed_at: "2026-10-01T00:00:00Z" }), m("b"), m("c")],
      [
        { id: "t1", status: "done" },
        { id: "t2", status: "todo" },
        { id: "t3", status: "cancelled" },
        { id: "t1", status: "done" }, // linked both directly and via a project: counted once
      ],
    );
    expect(progress).toEqual({
      milestones: { done: 1, total: 3, percent: 33 },
      measure: { current: 6, target: 24, unit: "books", percent: 25 },
      work: { done: 1, total: 2, percent: 50 },
    });
  });

  it("has no measure without a target, and caps the measure at 100%", () => {
    expect(measureOf({ target_value: null, current_value: null, unit: null })).toBeNull();
    expect(measureOf({ target_value: 10, current_value: 15, unit: null })?.percent).toBe(100);
    expect(measureOf({ target_value: 10, current_value: null, unit: "km" })).toEqual({
      current: 0,
      target: 10,
      unit: "km",
      percent: 0,
    });
  });

  it("is empty, not failing, for a goal with nothing linked yet", () => {
    expect(goalProgress({ target_value: null, current_value: null, unit: null }, [], [])).toEqual({
      milestones: { done: 0, total: 0, percent: 0 },
      measure: null,
      work: { done: 0, total: 0, percent: 0 },
    });
  });
});

describe("next milestone", () => {
  it("picks the earliest due open milestone, then list order", () => {
    const list = [
      m("done", { due_date: "2026-01-01", completed_at: "2026-01-01T00:00:00Z" }),
      m("undated", { sort_order: 0 }),
      m("later", { due_date: "2026-12-01", sort_order: 2 }),
      m("sooner", { due_date: "2026-11-01", sort_order: 3 }),
    ];
    expect(nextMilestone(list)?.id).toBe("sooner");
    expect(nextMilestone([m("x", { sort_order: 2 }), m("y", { sort_order: 1 })])?.id).toBe("y");
    expect(nextMilestone([m("d", { completed_at: "2026-01-01T00:00:00Z" })])).toBeNull();
  });
});

describe("overdue goals", () => {
  it("only flags active or paused goals past their target date", () => {
    expect(isGoalOverdue({ target_date: "2026-10-01", status: "active" }, "2026-10-12")).toBe(true);
    expect(isGoalOverdue({ target_date: "2026-10-12", status: "active" }, "2026-10-12")).toBe(
      false,
    );
    expect(isGoalOverdue({ target_date: "2026-10-01", status: "achieved" }, "2026-10-12")).toBe(
      false,
    );
    expect(isGoalOverdue({ target_date: null, status: "active" }, "2026-10-12")).toBe(false);
  });
});
