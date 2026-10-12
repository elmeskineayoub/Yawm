import { describe, expect, it } from "vitest";
import {
  formatTimeRange,
  hoursInLocalDay,
  instantToLocal,
  isoWeekNumber,
  localToInstant,
  zonedDayRange,
  zonedRange,
} from "@/lib/dates/zoned";

describe("zoned day ranges", () => {
  it("starts the day at local midnight", () => {
    expect(zonedDayRange("2026-10-14", "Asia/Tokyo")).toEqual({
      start: "2026-10-13T15:00:00.000Z",
      end: "2026-10-14T15:00:00.000Z",
    });
    expect(zonedDayRange("2026-10-14", "America/Los_Angeles").start).toBe(
      "2026-10-14T07:00:00.000Z",
    );
  });

  it("has 23- and 25-hour days across daylight-saving changes", () => {
    expect(hoursInLocalDay("2026-03-29", "Europe/London")).toBe(23);
    expect(hoursInLocalDay("2026-10-25", "Europe/London")).toBe(25);
    expect(hoursInLocalDay("2026-10-26", "Europe/London")).toBe(24);
    expect(hoursInLocalDay("2026-10-25", "Asia/Tokyo")).toBe(24);
  });

  it("spans whole local days for a multi-day range", () => {
    // Europe/London: BST (UTC+1) until Oct 25, then GMT.
    expect(zonedRange("2026-10-19", "2026-10-26", "Europe/London")).toEqual({
      start: "2026-10-18T23:00:00.000Z",
      end: "2026-10-26T00:00:00.000Z",
    });
  });
});

describe("local time ⇄ instant", () => {
  it("round-trips wall-clock times", () => {
    const instant = localToInstant("2026-10-14", "09:30", "Asia/Tokyo");
    expect(instant).toBe("2026-10-14T00:30:00.000Z");
    expect(instantToLocal(instant, "Asia/Tokyo")).toEqual({ date: "2026-10-14", time: "09:30" });
  });

  it("shows the same instant on different local dates in different zones", () => {
    const instant = "2026-10-14T23:30:00.000Z";
    expect(instantToLocal(instant, "UTC")).toEqual({ date: "2026-10-14", time: "23:30" });
    expect(instantToLocal(instant, "Asia/Tokyo")).toEqual({ date: "2026-10-15", time: "08:30" });
    expect(instantToLocal(instant, "America/New_York")).toEqual({
      date: "2026-10-14",
      time: "19:30",
    });
  });

  it("moves times inside a spring-forward gap to a valid time", () => {
    // 01:30 does not exist in London on 2026-03-29.
    const instant = localToInstant("2026-03-29", "01:30", "Europe/London");
    expect(instantToLocal(instant, "Europe/London").time).toBe("02:30");
  });

  it("formats ranges and marks blocks that end the next day", () => {
    expect(formatTimeRange("2026-10-14T08:00:00Z", "2026-10-14T09:30:00Z", "Europe/London")).toBe(
      "09:00–10:30",
    );
    expect(formatTimeRange("2026-10-14T21:00:00Z", "2026-10-14T23:30:00Z", "Europe/London")).toBe(
      "22:00–00:30 (+1 day)",
    );
  });

  it("numbers ISO weeks", () => {
    expect(isoWeekNumber("2026-10-12")).toBe(42);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
  });
});
