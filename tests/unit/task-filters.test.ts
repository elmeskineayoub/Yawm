import { describe, expect, it } from "vitest";
import { hasActiveFilters, parseTaskFilters, taskFiltersToSearch } from "@/features/tasks/filters";

const PROJECT = "7d9f2c8e-1b2a-4c3d-8e9f-0a1b2c3d4e5f";

describe("task filters", () => {
  it("defaults to open tasks in the list and all tasks on the board", () => {
    expect(parseTaskFilters({})).toMatchObject({ status: "open", view: "list", sort: "due" });
    expect(parseTaskFilters({ view: "board" })).toMatchObject({ status: "all", view: "board" });
    expect(hasActiveFilters(parseTaskFilters({}))).toBe(false);
    expect(hasActiveFilters(parseTaskFilters({ view: "board" }))).toBe(false);
  });

  it("ignores unknown values and malformed ids", () => {
    expect(
      parseTaskFilters({ status: "bogus", priority: "max", project: "1 or 1=1", sort: "x" }),
    ).toMatchObject({ status: "open", priority: null, projectId: null, sort: "due" });
  });

  it("round-trips through the query string, omitting defaults", () => {
    const filters = parseTaskFilters({
      q: " report ",
      status: "done",
      priority: "high",
      project: PROJECT,
      due: "week",
      group: "project",
    });
    const search = taskFiltersToSearch(filters);
    expect(search).toBe(
      `?q=report&status=done&priority=high&project=${PROJECT}&due=week&group=project`,
    );
    expect(parseTaskFilters(Object.fromEntries(new URLSearchParams(search)))).toEqual(filters);
    expect(taskFiltersToSearch(parseTaskFilters({}))).toBe("");
  });
});
