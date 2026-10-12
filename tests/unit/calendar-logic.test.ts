import { describe, expect, it } from "vitest";
import {
  defaultBlockMinutes,
  needsRescheduling,
  overlappingIds,
  overlapsWith,
  spansOverlap,
  unscheduledTasks,
  visibleDates,
} from "@/features/calendar/logic";
import { blockInputSchema, blockTimesSchema } from "@/features/calendar/schemas";

const span = (id: string, start: string, end: string) => ({
  id,
  starts_at: `2026-10-14T${start}:00Z`,
  ends_at: `2026-10-14T${end}:00Z`,
});

describe("overlaps", () => {
  it("treats touching blocks as not overlapping", () => {
    expect(spansOverlap(span("a", "09:00", "10:00"), span("b", "10:00", "11:00"))).toBe(false);
    expect(spansOverlap(span("a", "09:00", "10:01"), span("b", "10:00", "11:00"))).toBe(true);
    expect(spansOverlap(span("a", "09:00", "12:00"), span("b", "10:00", "11:00"))).toBe(true);
  });

  it("finds every overlapping block", () => {
    const blocks = [
      span("a", "09:00", "10:00"),
      span("b", "09:30", "09:45"),
      span("c", "10:00", "11:00"),
      span("d", "10:30", "12:00"),
      span("e", "13:00", "14:00"),
    ];
    expect([...overlappingIds(blocks)].sort()).toEqual(["a", "b", "c", "d"]);
    expect(overlapsWith({ ...span("x", "09:50", "10:40") }, blocks).map((b) => b.id)).toEqual([
      "a",
      "c",
      "d",
    ]);
    // A block does not overlap itself when being moved.
    expect(overlapsWith(span("e", "13:30", "14:30"), blocks)).toEqual([]);
  });
});

describe("unscheduled and rescheduling", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const tasks = [
    { id: "future", status: "todo" as const, due_date: null },
    { id: "missed", status: "todo" as const, due_date: null },
    { id: "late", status: "in_progress" as const, due_date: "2026-10-13" },
    { id: "free", status: "todo" as const, due_date: "2026-10-14" },
    { id: "done", status: "done" as const, due_date: "2026-10-01" },
  ];
  const blocks = [
    { task_id: "future", starts_at: "2026-10-14T13:00:00Z", ends_at: "2026-10-14T14:00:00Z" },
    { task_id: "missed", starts_at: "2026-10-14T08:00:00Z", ends_at: "2026-10-14T09:00:00Z" },
    { task_id: null, starts_at: "2026-10-14T08:00:00Z", ends_at: "2026-10-14T09:00:00Z" },
  ];

  it("lists open tasks with no upcoming block", () => {
    expect(unscheduledTasks(tasks, blocks, now).map((t) => t.id)).toEqual([
      "missed",
      "late",
      "free",
    ]);
  });

  it("flags missed blocks and overdue deadlines, never finished work", () => {
    expect(needsRescheduling(tasks, blocks, now, "2026-10-14")).toEqual([
      { task: tasks[1], reasons: ["missed_block"] },
      { task: tasks[2], reasons: ["overdue"] },
    ]);
  });

  it("uses the estimate for the default block length", () => {
    expect(defaultBlockMinutes(null)).toBe(30);
    expect(defaultBlockMinutes(50)).toBe(45);
    expect(defaultBlockMinutes(5)).toBe(15);
    expect(defaultBlockMinutes(1000)).toBe(480);
  });
});

describe("visibleDates", () => {
  it("covers whole weeks around a month", () => {
    // October 2026: Thu 1 → Sat 31. Monday weeks: Sep 28 → Nov 2 (exclusive Nov 2).
    expect(visibleDates("month", "2026-10-01", 1)).toEqual({
      from: "2026-09-28",
      to: "2026-11-02",
    });
    // Sunday weeks: Sep 27 → Nov 1.
    expect(visibleDates("month", "2026-10-01", 0)).toEqual({
      from: "2026-09-27",
      to: "2026-11-01",
    });
    expect(visibleDates("week", "2026-10-12", 1)).toEqual({ from: "2026-10-12", to: "2026-10-19" });
    expect(visibleDates("day", "2026-10-12", 1)).toEqual({ from: "2026-10-12", to: "2026-10-13" });
  });
});

describe("block validation", () => {
  const base = {
    title: "Write",
    starts_at: "2026-10-14T09:00:00.000Z",
    ends_at: "2026-10-14T10:00:00.000Z",
  };

  it("accepts offsets and optional links", () => {
    const parsed = blockInputSchema.parse({ ...base, starts_at: "2026-10-14T18:00:00+09:00" });
    expect(parsed.task_id).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("rejects empty, backwards, and over-long blocks", () => {
    expect(blockInputSchema.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(blockInputSchema.safeParse({ ...base, ends_at: base.starts_at }).success).toBe(false);
    expect(
      blockInputSchema.safeParse({ ...base, ends_at: "2026-10-15T09:01:00.000Z" }).success,
    ).toBe(false);
    expect(
      blockTimesSchema.safeParse({ starts_at: base.ends_at, ends_at: base.starts_at }).success,
    ).toBe(false);
    expect(blockInputSchema.safeParse({ ...base, starts_at: "tomorrow" }).success).toBe(false);
  });
});
