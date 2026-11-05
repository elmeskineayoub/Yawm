import { describe, expect, it } from "vitest";
import { buildDayAgenda, formatMinutes, summarizeToday } from "@/features/tasks/today-logic";

// Tokyo is UTC+9 with no daylight saving: 09:00 local = 00:00Z.
const TZ = "Asia/Tokyo";
const TODAY = "2026-11-05";
const at = (hhmm: string) => new Date(`${TODAY}T${hhmm}:00+09:00`);
const iso = (hhmm: string) => at(hhmm).toISOString();
const block = (id: string, from: string, to: string, status?: string) => ({
  id,
  title: id,
  starts_at: iso(from),
  ends_at: iso(to),
  task: status ? { id: `t-${id}`, status } : null,
});

describe("buildDayAgenda", () => {
  it("orders blocks and timed deadlines, marks past/current/upcoming, and places now", () => {
    const items = buildDayAgenda({
      blocks: [block("Deep work", "13:00", "15:00"), block("Standup", "09:00", "09:15", "done")],
      deadlines: [{ id: "d1", title: "Send invoice", due_time: "17:00:00", status: "todo" }],
      today: TODAY,
      timezone: TZ,
      now: at("10:00"),
    });
    expect(items.map((i) => i.kind)).toEqual(["block", "now", "gap", "block", "deadline"]);
    const [standup, , gap, deep, deadline] = items;
    expect(standup).toMatchObject({
      kind: "block",
      title: "Standup",
      state: "past",
      done: true,
      taskId: "t-Standup",
    });
    // Free time from now (10:00) until the next block (13:00), not from the end of the last block.
    expect(gap).toMatchObject({
      kind: "gap",
      start: iso("10:00"),
      end: iso("13:00"),
      minutes: 180,
    });
    expect(deep).toMatchObject({ kind: "block", state: "upcoming" });
    expect(deadline).toMatchObject({ kind: "deadline", at: iso("17:00"), past: false });
  });

  it("marks the block in progress as current and shows no gap before it", () => {
    const items = buildDayAgenda({
      blocks: [block("Writing", "09:30", "11:00"), block("Lunch", "12:00", "13:00")],
      deadlines: [],
      today: TODAY,
      timezone: TZ,
      now: at("10:00"),
    });
    expect(items.map((i) => i.kind)).toEqual(["block", "now", "gap", "block"]);
    expect(items[0]).toMatchObject({ state: "current" });
    // The gap starts when the current block ends (11:00), not at now.
    expect(items[2]).toMatchObject({ start: iso("11:00"), end: iso("12:00"), minutes: 60 });
  });

  it("skips gaps shorter than 30 minutes and past free time", () => {
    const items = buildDayAgenda({
      blocks: [
        block("A", "08:00", "09:00"),
        block("B", "10:00", "11:00"),
        block("C", "11:20", "12:00"),
      ],
      deadlines: [],
      today: TODAY,
      timezone: TZ,
      now: at("15:00"),
    });
    expect(items.filter((i) => i.kind === "gap")).toHaveLength(0);
    expect(items.at(-1)).toMatchObject({ kind: "now" });
  });

  it("puts now last when everything is over, and omits it on another day", () => {
    const done = buildDayAgenda({
      blocks: [],
      deadlines: [],
      today: TODAY,
      timezone: TZ,
      now: at("20:00"),
    });
    expect(done).toEqual([{ kind: "now", at: iso("20:00") }]);
    const otherDay = buildDayAgenda({
      blocks: [block("A", "08:00", "09:00")],
      deadlines: [],
      today: TODAY,
      timezone: TZ,
      now: new Date("2026-11-06T03:00:00Z"), // 12:00 on the 6th in Tokyo
    });
    expect(otherDay.some((i) => i.kind === "now")).toBe(false);
  });
});

describe("summarizeToday", () => {
  it("says what matters in one sentence", () => {
    expect(
      summarizeToday({
        overdue: 3,
        dueToday: 2,
        completedToday: 1,
        habitsDone: 1,
        habitsDue: 2,
        next: { title: "Standup", time: "10:15" },
      }),
    ).toBe("3 overdue, 2 due today, 1 done, 1 of 2 habits done, next up: Standup at 10:15.");
  });

  it("handles a clear day honestly", () => {
    expect(
      summarizeToday({
        overdue: 0,
        dueToday: 0,
        completedToday: 0,
        habitsDone: 0,
        habitsDue: 0,
        next: null,
      }),
    ).toBe("Nothing due, nothing scheduled.");
    expect(
      summarizeToday({
        overdue: 0,
        dueToday: 0,
        completedToday: 2,
        habitsDone: 1,
        habitsDue: 1,
        next: null,
        scheduledToday: 2,
      }),
    ).toBe("Nothing else due, 2 done, 1 of 1 habit done, nothing else scheduled.");
  });
});

describe("formatMinutes", () => {
  it("formats durations compactly", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(150)).toBe("2h 30m");
  });
});
