import { describe, expect, it } from "vitest";
import {
  buildJournalTemplate,
  energyLabel,
  entryPreview,
  groupByMonth,
  JOURNAL_PROMPTS,
  moodLabel,
} from "@/features/journal/logic";

describe("buildJournalTemplate", () => {
  it("lists each prompt with space to write under it", () => {
    const template = buildJournalTemplate(["First?", "Second?"]);
    expect(template).toBe("First?\n\n\nSecond?\n");
  });

  it("defaults to the five daily prompts", () => {
    const template = buildJournalTemplate();
    for (const prompt of JOURNAL_PROMPTS) expect(template).toContain(prompt);
  });
});

describe("mood and energy labels", () => {
  it("map 1–5 to a word and null/out-of-range to null", () => {
    expect(moodLabel(1)).toBe("Very low");
    expect(moodLabel(5)).toBe("Great");
    expect(moodLabel(null)).toBeNull();
    expect(moodLabel(0)).toBeNull();
    expect(moodLabel(6)).toBeNull();
    expect(energyLabel(3)).toBe("Moderate");
    expect(energyLabel(null)).toBeNull();
  });
});

describe("groupByMonth", () => {
  it("groups by calendar month, keeping the given order and first-seen month order", () => {
    const groups = groupByMonth([
      { entry_date: "2026-10-14" },
      { entry_date: "2026-10-02" },
      { entry_date: "2026-09-30" },
      { entry_date: "2026-10-01" },
    ]);
    expect(groups.map((g) => g.month)).toEqual(["2026-10", "2026-09"]);
    expect(groups[0]!.entries.map((e) => e.entry_date)).toEqual([
      "2026-10-14",
      "2026-10-02",
      "2026-10-01",
    ]);
    expect(groups[1]!.entries).toHaveLength(1);
  });

  it("returns nothing for no entries", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("entryPreview", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    expect(entryPreview("  hello   world \n\n done ")).toBe("hello world done");
    expect(entryPreview(null)).toBe("");
    expect(entryPreview("abcdef", 4)).toBe("abc…");
    expect(entryPreview("abcd", 4)).toBe("abcd");
  });
});
