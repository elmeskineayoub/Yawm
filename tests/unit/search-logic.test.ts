import { describe, expect, it } from "vitest";
import {
  cleanQuery,
  excerpt,
  highlightParts,
  MAX_QUERY_LENGTH,
  moduleSearchHref,
} from "@/features/search/logic";

describe("cleanQuery", () => {
  it("trims, collapses whitespace, and ignores queries that are too short", () => {
    expect(cleanQuery("  plan   the  week ")).toBe("plan the week");
    expect(cleanQuery("a")).toBeNull();
    expect(cleanQuery("   ")).toBeNull();
    expect(cleanQuery(null)).toBeNull();
    expect(cleanQuery("x".repeat(500))).toHaveLength(MAX_QUERY_LENGTH);
  });
});

describe("excerpt", () => {
  const text =
    "Morning pages are a habit I keep coming back to. Today the walk by the river helped me think about the newsletter plan and what to cut.";

  it("returns the passage around the match with ellipses where cut", () => {
    const result = excerpt(text, "river", 20)!;
    expect(result).toContain("river");
    expect(result.startsWith("… ")).toBe(true);
    expect(result.endsWith(" …")).toBe(true);
    expect(result.length).toBeLessThan(text.length);
  });

  it("matches case-insensitively and flattens line breaks", () => {
    expect(excerpt("First line\n\nSecond LINE here", "line two", 10)).toBeNull();
    expect(excerpt("First line\n\nSecond LINE here", "second line", 40)).toBe(
      "First line Second LINE here",
    );
  });

  it("is null when there is nothing to show", () => {
    expect(excerpt(null, "x")).toBeNull();
    expect(excerpt("", "x")).toBeNull();
    expect(excerpt("nothing here", "absent")).toBeNull();
  });
});

describe("highlightParts", () => {
  it("splits every case-insensitive occurrence without losing text", () => {
    const parts = highlightParts("Plan the plan, PLAN!", "plan");
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(["Plan", "plan", "PLAN"]);
    expect(parts.map((p) => p.text).join("")).toBe("Plan the plan, PLAN!");
  });
  it("returns the whole text when there is no query or match", () => {
    expect(highlightParts("abc", "")).toEqual([{ text: "abc", match: false }]);
    expect(highlightParts("abc", "z")).toEqual([{ text: "abc", match: false }]);
  });
});

describe("moduleSearchHref", () => {
  it("links to modules with their own search, encoding the query", () => {
    expect(moduleSearchHref("task", "a&b")).toBe("/tasks?q=a%26b&status=all");
    expect(moduleSearchHref("idea", "x")).toBe("/inbox?status=all&q=x");
    expect(moduleSearchHref("project", "x")).toBeNull();
    expect(moduleSearchHref("goal", "x")).toBeNull();
  });
});
