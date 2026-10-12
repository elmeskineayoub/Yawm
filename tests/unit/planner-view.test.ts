import { describe, expect, it } from "vitest";
import { parsePlannerParams, plannerHref } from "@/features/planning/view";
import { formatPeriodShort, formatPeriodTitle } from "@/lib/dates";

const today = "2026-10-14"; // Wednesday

describe("parsePlannerParams", () => {
  it("defaults to this week", () => {
    expect(parsePlannerParams({}, today, 1)).toEqual({
      view: "week",
      date: today,
      start: "2026-10-12",
    });
  });

  it("normalises any date to the start of the chosen period", () => {
    expect(parsePlannerParams({ view: "month", date: "2026-02-17" }, today, 1).start).toBe(
      "2026-02-01",
    );
    expect(parsePlannerParams({ view: "year", date: "2026-07-04" }, today, 1).start).toBe(
      "2026-01-01",
    );
    expect(parsePlannerParams({ view: "week", date: "2026-10-18" }, today, 1).start).toBe(
      "2026-10-12",
    );
    expect(parsePlannerParams({ view: "week", date: "2026-10-18" }, today, 0).start).toBe(
      "2026-10-18",
    );
    expect(parsePlannerParams({ view: "day", date: "2026-10-18" }, today, 1).start).toBe(
      "2026-10-18",
    );
  });

  it("accepts the old period parameter and rejects junk", () => {
    expect(parsePlannerParams({ period: "day" }, today, 1).view).toBe("day");
    expect(parsePlannerParams({ view: "decade", date: "2026-13-40" }, today, 1)).toEqual({
      view: "week",
      date: today,
      start: "2026-10-12",
    });
  });

  it("builds links", () => {
    expect(plannerHref("day", "2026-10-14")).toBe("/planner?view=day&date=2026-10-14");
  });
});

describe("period titles", () => {
  it("labels each period clearly", () => {
    expect(formatPeriodTitle("day", "2026-10-14")).toBe("Wednesday, October 14");
    expect(formatPeriodTitle("week", "2026-10-12")).toBe("Oct 12 – 18, 2026");
    expect(formatPeriodTitle("week", "2026-12-28")).toBe("Dec 28 – Jan 3, 2027");
    expect(formatPeriodTitle("month", "2026-10-01")).toBe("October 2026");
    expect(formatPeriodTitle("year", "2026-01-01")).toBe("2026");
    expect(formatPeriodShort("week", "2026-10-12")).toBe("Week of Oct 12");
    expect(formatPeriodShort("month", "2026-10-01")).toBe("October");
  });
});
