import { describe, expect, it } from "vitest";
import {
  completionRate,
  dayStatus,
  describeSchedule,
  isDone,
  isDueOn,
  isoWeekday,
  streaks,
  type HabitLog,
  type HabitRule,
} from "@/features/habits/logic";
import { todayIn } from "@/lib/dates";

// October 2026: Monday 5, 12, 19. Week of Monday 12 → Sunday 18.
const daily = (fields: Partial<HabitRule> = {}): HabitRule => ({
  kind: "boolean",
  target_value: null,
  frequency: "daily",
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  times_per_week: null,
  starts_on: "2026-09-01",
  ends_on: null,
  ...fields,
});
const weekly = (times: number, fields: Partial<HabitRule> = {}) =>
  daily({ frequency: "weekly", times_per_week: times, ...fields });

const done = (...dates: string[]): HabitLog[] =>
  dates.map((log_date) => ({ log_date, value: 1, rest: false }));
const rest = (...dates: string[]): HabitLog[] =>
  dates.map((log_date) => ({ log_date, value: null, rest: true }));

describe("schedule basics", () => {
  it("uses ISO weekdays", () => {
    expect(isoWeekday("2026-10-12")).toBe(1);
    expect(isoWeekday("2026-10-18")).toBe(7);
  });

  it("describes schedules in plain language", () => {
    expect(describeSchedule(daily())).toBe("Every day");
    expect(describeSchedule(daily({ weekdays: [1, 2, 3, 4, 5] }))).toBe("Weekdays");
    expect(describeSchedule(daily({ weekdays: [5, 1, 3] }))).toBe("Mon, Wed, Fri");
    expect(describeSchedule(weekly(3))).toBe("3× a week");
  });

  it("counts a measurable day only once the target is reached", () => {
    const pages = daily({ kind: "measurable", target_value: 20 });
    expect(isDone(pages, { log_date: "2026-10-12", value: 19.5, rest: false })).toBe(false);
    expect(isDone(pages, { log_date: "2026-10-12", value: 20, rest: false })).toBe(true);
    expect(isDone(pages, { log_date: "2026-10-12", value: null, rest: true })).toBe(false);
  });

  it("classifies days", () => {
    const mwf = daily({ weekdays: [1, 3, 5] });
    const today = "2026-10-14";
    expect(dayStatus(mwf, "2026-10-13", undefined, today)).toBe("rest"); // Tuesday: not scheduled
    expect(dayStatus(mwf, "2026-10-12", undefined, today)).toBe("missed");
    expect(dayStatus(mwf, "2026-10-14", undefined, today)).toBe("open");
    expect(dayStatus(mwf, "2026-10-12", rest("2026-10-12")[0], today)).toBe("rest");
    expect(dayStatus(mwf, "2026-08-31", undefined, today)).toBe("inactive");
    // A weekly habit's undone day is open, never missed: only whole weeks are judged.
    expect(dayStatus(weekly(3), "2026-10-12", undefined, today)).toBe("open");
  });
});

describe("daily streaks", () => {
  it("counts consecutive completed days up to today", () => {
    expect(streaks(daily(), done("2026-10-10", "2026-10-11", "2026-10-12"), "2026-10-12")).toEqual({
      current: 3,
      longest: 3,
      unit: "day",
    });
  });

  it("doesn't break the streak while today is still open", () => {
    expect(streaks(daily(), done("2026-10-10", "2026-10-11"), "2026-10-12").current).toBe(2);
  });

  it("a missed day ends the current streak but not the longest", () => {
    const s = streaks(daily(), done("2026-10-08", "2026-10-09", "2026-10-11"), "2026-10-12");
    expect(s).toMatchObject({ current: 1, longest: 2 });
  });

  it("skips weekdays the habit isn't scheduled on", () => {
    const mwf = daily({ weekdays: [1, 3, 5] });
    const logs = done("2026-10-05", "2026-10-07", "2026-10-09", "2026-10-12");
    expect(streaks(mwf, logs, "2026-10-12").current).toBe(4);
  });

  it("never counts an explicit rest day as a failure", () => {
    const logs = [...done("2026-10-09", "2026-10-11"), ...rest("2026-10-10")];
    expect(streaks(daily(), logs, "2026-10-12").current).toBe(2);
  });

  it("recalculates when a past day is edited", () => {
    const before = done("2026-10-09", "2026-10-11");
    expect(streaks(daily(), before, "2026-10-11").current).toBe(1);
    const after = [...before, ...done("2026-10-10")];
    expect(streaks(daily(), after, "2026-10-11")).toMatchObject({ current: 3, longest: 3 });
    // Un-marking a day breaks it again.
    expect(streaks(daily(), done("2026-10-09", "2026-10-11"), "2026-10-11").current).toBe(1);
  });

  it("ignores days outside the active period", () => {
    const habit = daily({ starts_on: "2026-10-10", ends_on: "2026-10-11" });
    const logs = done("2026-10-08", "2026-10-10", "2026-10-11");
    expect(streaks(habit, logs, "2026-10-20")).toMatchObject({ current: 2, longest: 2 });
    expect(streaks(daily({ starts_on: "2026-11-01" }), [], "2026-10-20").current).toBe(0);
  });

  it("an unmet measurable day counts as a miss", () => {
    const pages = daily({ kind: "measurable", target_value: 20 });
    const logs: HabitLog[] = [
      { log_date: "2026-10-10", value: 25, rest: false },
      { log_date: "2026-10-11", value: 5, rest: false },
    ];
    expect(streaks(pages, logs, "2026-10-12")).toMatchObject({ current: 0, longest: 1 });
  });
});

describe("weekly habits (N times a week)", () => {
  it("counts weeks that met the target; the current week doesn't break it", () => {
    const logs = done(
      "2026-09-29", // week of Sep 28: 2 of 3 → missed
      "2026-10-01",
      "2026-10-05", // week of Oct 5: 3 of 3 → met
      "2026-10-07",
      "2026-10-09",
      "2026-10-12", // current week: 1 so far
    );
    expect(streaks(weekly(3), logs, "2026-10-13")).toEqual({
      current: 1,
      longest: 1,
      unit: "week",
    });
  });

  it("lowers a week's target for each rest day", () => {
    const logs = [...done("2026-10-05", "2026-10-06"), ...rest("2026-10-07")];
    expect(streaks(weekly(3), logs, "2026-10-13").current).toBe(1);
  });

  it("caps a partial first week at its active days", () => {
    // Starts Saturday Oct 10: only 2 active days that week, so 2 of "5 a week" meets it.
    const habit = weekly(5, { starts_on: "2026-10-10" });
    expect(streaks(habit, done("2026-10-10", "2026-10-11"), "2026-10-13").current).toBe(1);
  });

  it("groups weeks by the user's week start", () => {
    // Sat 10, Sun 11, Mon 12: one week when weeks start on Saturday (met), but split across
    // two weeks when they start on Monday (2 of 3 the week before, so the streak is 0).
    const logs = done("2026-10-10", "2026-10-11", "2026-10-12");
    const habit = weekly(3, { starts_on: "2026-10-03" });
    expect(streaks(habit, logs, "2026-10-16", 6).current).toBe(1);
    expect(streaks(habit, logs, "2026-10-16", 1).current).toBe(0);
  });

  it("is due today until the week's target is met", () => {
    const habit = weekly(2);
    expect(isDueOn(habit, done("2026-10-12"), "2026-10-13")).toBe(true);
    expect(isDueOn(habit, done("2026-10-12", "2026-10-13"), "2026-10-14")).toBe(false);
    // Still listed (as done) on the day it was completed.
    expect(isDueOn(habit, done("2026-10-12", "2026-10-13"), "2026-10-13")).toBe(true);
  });
});

describe("completion rates", () => {
  it("counts only due days, excluding rest days and today while open", () => {
    const mwf = daily({ weekdays: [1, 3, 5] });
    // Week of Oct 12, today Friday 16: Mon done, Wed missed, Fri still open.
    expect(
      completionRate(mwf, done("2026-10-12"), "2026-10-12", "2026-10-18", "2026-10-16"),
    ).toEqual({
      done: 1,
      due: 2,
      rate: 0.5,
    });
    expect(
      completionRate(mwf, rest("2026-10-12"), "2026-10-12", "2026-10-13", "2026-10-13").rate,
    ).toBeNull();
  });

  it("caps weekly completions at each week's target", () => {
    const logs = done("2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08");
    expect(completionRate(weekly(2), logs, "2026-10-05", "2026-10-11", "2026-10-20")).toEqual({
      done: 2,
      due: 2,
      rate: 1,
    });
  });
});

describe("timezones", () => {
  it("'today' follows the profile timezone, not UTC", () => {
    const instant = new Date("2026-10-12T22:30:00Z");
    expect(todayIn("Pacific/Auckland", instant)).toBe("2026-10-13");
    expect(todayIn("America/Los_Angeles", instant)).toBe("2026-10-12");
    const logs = done("2026-10-11", "2026-10-12");
    // In Auckland it's already Tuesday and Tuesday is open: the streak is intact either way.
    expect(streaks(daily(), logs, todayIn("Pacific/Auckland", instant)).current).toBe(2);
    expect(streaks(daily(), logs, todayIn("America/Los_Angeles", instant)).current).toBe(2);
  });

  it("a daylight-saving change doesn't add or drop a day", () => {
    // New York springs forward on 2026-03-08 and falls back on 2026-11-01.
    expect(todayIn("America/New_York", new Date("2026-03-08T07:30:00Z"))).toBe("2026-03-08");
    expect(todayIn("America/New_York", new Date("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
    const logs = done("2026-03-07", "2026-03-08", "2026-03-09", "2026-10-31", "2026-11-01");
    const spring = daily({ starts_on: "2026-03-07", ends_on: "2026-03-09" });
    const fall = daily({ starts_on: "2026-10-31", ends_on: "2026-11-01" });
    expect(streaks(spring, logs, "2026-03-09").current).toBe(3);
    expect(streaks(fall, logs, "2026-11-01").current).toBe(2);
  });
});
