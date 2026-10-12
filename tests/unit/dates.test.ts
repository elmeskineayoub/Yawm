import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayOfWeek,
  formatPeriod,
  isIsoDate,
  periodEnd,
  periodStart,
  relativeDateLabel,
  shiftPeriod,
  todayIn,
} from "@/lib/dates";

describe("todayIn", () => {
  const instant = new Date("2026-10-12T23:30:00Z");

  it("uses the user's timezone, not UTC", () => {
    expect(todayIn("UTC", instant)).toBe("2026-10-12");
    expect(todayIn("Asia/Tokyo", instant)).toBe("2026-10-13");
    expect(todayIn("America/Los_Angeles", instant)).toBe("2026-10-12");
    expect(todayIn("Pacific/Kiritimati", new Date("2026-10-12T10:00:00Z"))).toBe("2026-10-13");
  });

  it("is correct across a daylight-saving change", () => {
    // Europe/London leaves BST at 01:00 UTC on 2026-10-25.
    expect(todayIn("Europe/London", new Date("2026-10-24T23:30:00Z"))).toBe("2026-10-25");
    expect(todayIn("Europe/London", new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-25");
  });
});

describe("date arithmetic", () => {
  it("validates real calendar dates", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
  });

  it("adds days across month, year, and DST boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("clamps month addition to the end of shorter months", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("knows weekdays", () => {
    expect(dayOfWeek("2026-10-12")).toBe(1); // Monday
    expect(dayOfWeek("2026-10-18")).toBe(0); // Sunday
  });
});

describe("periods", () => {
  it("finds period starts, honouring the week-start preference", () => {
    // Wednesday 2026-10-14
    expect(periodStart("year", "2026-10-14")).toBe("2026-01-01");
    expect(periodStart("month", "2026-10-14")).toBe("2026-10-01");
    expect(periodStart("week", "2026-10-14", 1)).toBe("2026-10-12");
    expect(periodStart("week", "2026-10-14", 0)).toBe("2026-10-11");
    expect(periodStart("week", "2026-10-12", 1)).toBe("2026-10-12");
    expect(periodStart("week", "2026-10-11", 1)).toBe("2026-10-05");
    expect(periodStart("day", "2026-10-14")).toBe("2026-10-14");
  });

  it("computes exclusive ends and steps between periods", () => {
    expect(periodEnd("month", "2026-02-01")).toBe("2026-03-01");
    expect(periodEnd("week", "2026-12-28")).toBe("2027-01-04");
    expect(periodEnd("year", "2028-01-01")).toBe("2029-01-01");
    expect(shiftPeriod("month", "2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftPeriod("week", "2026-10-12", -1)).toBe("2026-10-05");
    expect(shiftPeriod("year", "2026-01-01", -1)).toBe("2025-01-01");
  });

  it("labels periods", () => {
    expect(formatPeriod("year", "2026-01-01")).toBe("2026");
    expect(formatPeriod("month", "2026-10-01")).toBe("October 2026");
    expect(formatPeriod("week", "2026-10-12")).toBe("Week of Mon, Oct 12, 2026");
  });

  it("labels dates relative to today", () => {
    expect(relativeDateLabel("2026-10-12", "2026-10-12")).toBe("Today");
    expect(relativeDateLabel("2026-10-13", "2026-10-12")).toBe("Tomorrow");
    expect(relativeDateLabel("2026-10-11", "2026-10-12")).toBe("Yesterday");
    expect(relativeDateLabel("2026-11-02", "2026-10-12")).toBe("Nov 2");
    expect(relativeDateLabel("2027-01-02", "2026-10-12")).toBe("Sat, Jan 2, 2027");
  });
});

describe("dateOfInstant", () => {
  it("returns the local calendar date of a stored timestamp", async () => {
    const { dateOfInstant } = await import("@/lib/dates");
    expect(dateOfInstant("2026-10-12T23:30:00Z", "Asia/Tokyo")).toBe("2026-10-13");
    expect(dateOfInstant("2026-10-12T02:00:00Z", "America/New_York")).toBe("2026-10-11");
  });
});

describe("childStarts", () => {
  it("lists months, weeks starting in the month, and days", async () => {
    const { childStarts } = await import("@/features/planning/queries");
    expect(childStarts("year", "2026-01-01", 1)).toHaveLength(12);
    // October 2026 starts on a Thursday; Monday weeks starting inside it: 5, 12, 19, 26.
    expect(childStarts("month", "2026-10-01", 1)).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
    // Weeks starting Thursday include the 1st.
    expect(childStarts("month", "2026-10-01", 4)[0]).toBe("2026-10-01");
    expect(childStarts("week", "2026-10-12", 1)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(childStarts("day", "2026-10-12", 1)).toEqual([]);
  });
});
