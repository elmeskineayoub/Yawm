import { describe, expect, it } from "vitest";
import {
  compareTasks,
  describeRecurrence,
  friendlyTaskError,
  isOverdue,
  progressOf,
} from "@/features/tasks/logic";

describe("isOverdue", () => {
  const today = "2026-10-12";
  it("is true only for unfinished tasks due before today", () => {
    expect(isOverdue({ status: "todo", due_date: "2026-10-11" }, today)).toBe(true);
    expect(isOverdue({ status: "in_progress", due_date: "2026-10-01" }, today)).toBe(true);
    expect(isOverdue({ status: "todo", due_date: today }, today)).toBe(false);
    expect(isOverdue({ status: "done", due_date: "2026-10-01" }, today)).toBe(false);
    expect(isOverdue({ status: "cancelled", due_date: "2026-10-01" }, today)).toBe(false);
    expect(isOverdue({ status: "todo", due_date: null }, today)).toBe(false);
  });
});

describe("progressOf", () => {
  it("ignores cancelled tasks", () => {
    expect(progressOf([{ status: "done" }, { status: "todo" }, { status: "cancelled" }])).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    });
    expect(progressOf([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("compareTasks", () => {
  const base = { due_time: null, created_at: "2026-01-01T00:00:00Z" };
  const tasks = [
    { ...base, title: "b", priority: "low" as const, due_date: null },
    { ...base, title: "a", priority: "urgent" as const, due_date: "2026-10-20" },
    { ...base, title: "c", priority: "medium" as const, due_date: "2026-10-12" },
  ];

  it("sorts by due date with undated last", () => {
    expect([...tasks].sort(compareTasks("due")).map((t) => t.title)).toEqual(["c", "a", "b"]);
  });

  it("sorts by priority", () => {
    expect([...tasks].sort(compareTasks("priority")).map((t) => t.title)).toEqual(["a", "c", "b"]);
  });
});

describe("describeRecurrence", () => {
  const rule = { recurrence_interval: 1, recurrence_weekdays: null, recurrence_until: null };
  it("describes rules", () => {
    expect(describeRecurrence({ ...rule, recurrence_frequency: null })).toBeNull();
    expect(describeRecurrence({ ...rule, recurrence_frequency: "daily" })).toBe("Every day");
    expect(
      describeRecurrence({
        ...rule,
        recurrence_frequency: "weekly",
        recurrence_interval: 2,
        recurrence_weekdays: [5, 1, 0],
      }),
    ).toBe("Every 2 weeks on Mon, Fri, Sun");
    expect(
      describeRecurrence({
        ...rule,
        recurrence_frequency: "monthly",
        recurrence_anchor: "2026-01-31",
        recurrence_until: "2026-12-31",
      }),
    ).toBe("Every month on day 31 until 2026-12-31");
  });
});

describe("friendlyTaskError", () => {
  it("maps database rule errors", () => {
    expect(friendlyTaskError("TASK_BLOCKED: finish")).toMatch(/depends on unfinished/);
    expect(friendlyTaskError("DEPENDENCY_CYCLE: x")).toMatch(/circular/);
    expect(friendlyTaskError("weird")).toMatch(/try again/);
  });
});
