import { describe, expect, it } from "vitest";
import { monthGrid, weekdayInitials } from "@/features/journal/logic";

describe("journal month grid", () => {
  it("starts on Monday by default and pads outside days with null", () => {
    // November 2026 starts on a Sunday: six leading blanks in a Monday-first week.
    const weeks = monthGrid("2026-11", 1);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks.at(-1)).toEqual(["2026-11-30", null, null, null, null, null, null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it("respects a Sunday week start (profiles.week_start = 0)", () => {
    const weeks = monthGrid("2026-11", 0);
    expect(weeks[0]![0]).toBe("2026-11-01");
    expect(weeks).toHaveLength(5);
  });

  it("handles leap years and a month that starts exactly on the week start", () => {
    // February 2028 has 29 days and starts on a Tuesday.
    const leap = monthGrid("2028-02", 2);
    expect(leap[0]![0]).toBe("2028-02-01");
    expect(leap.flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid("2027-02", 1).flat().filter(Boolean)).toHaveLength(28);
  });

  it("every week has seven cells and dates stay in order across the year boundary", () => {
    const weeks = monthGrid("2026-12", 6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const days = weeks.flat().filter((d): d is string => d !== null);
    expect(days[0]).toBe("2026-12-01");
    expect(days.at(-1)).toBe("2026-12-31");
    expect([...days].sort()).toEqual(days);
  });

  it("names weekdays in calendar order", () => {
    expect(weekdayInitials(1)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(weekdayInitials(0)[0]).toBe("Sun");
    expect(weekdayInitials(6)[0]).toBe("Sat");
  });
});
