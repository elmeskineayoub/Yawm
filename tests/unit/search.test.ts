import { describe, expect, it } from "vitest";
import { escapeLike, ilikeAny, normalizeQuery } from "@/lib/search";

describe("search helpers", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("quotes values so PostgREST syntax in input cannot add filters", () => {
    expect(ilikeAny(["title", "body"], "a,b.or(id.eq.1)")).toBe(
      'title.ilike."%a,b.or(id.eq.1)%",body.ilike."%a,b.or(id.eq.1)%"',
    );
    expect(ilikeAny(["title"], 'say "hi"')).toBe('title.ilike."%say \\"hi\\"%"');
  });

  it("normalises the query parameter", () => {
    expect(normalizeQuery("  milk ")).toBe("milk");
    expect(normalizeQuery("   ")).toBeNull();
    expect(normalizeQuery(undefined)).toBeNull();
    expect(normalizeQuery(["first", "second"])).toBe("first");
    expect(normalizeQuery("x".repeat(500))).toHaveLength(200);
  });
});
