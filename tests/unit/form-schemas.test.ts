import { describe, expect, it } from "vitest";
import { quickTaskSchema, taskEditSchema } from "@/features/tasks/schemas";
import { optionalDate, optionalInt, optionalUuid, parseTagNames } from "@/lib/form";

describe("optional form fields", () => {
  it("treat missing and blank inputs as null", () => {
    for (const schema of [optionalDate, optionalUuid, optionalInt(1, 10)]) {
      expect(schema.parse(undefined)).toBeNull();
      expect(schema.parse("")).toBeNull();
      expect(schema.parse("  ")).toBeNull();
    }
  });

  it("still validate provided values", () => {
    expect(optionalDate.safeParse("2026-02-30").success).toBe(false);
    expect(optionalUuid.safeParse("nope").success).toBe(false);
    expect(optionalInt(1, 10).safeParse("11").success).toBe(false);
    expect(optionalInt(1, 10).parse("7")).toBe(7);
  });
});

describe("quickTaskSchema", () => {
  it("accepts a title alone, as quick-add forms send", () => {
    expect(quickTaskSchema.parse({ title: "Buy milk" })).toEqual({
      title: "Buy milk",
      due_date: null,
      priority: "medium",
      project_id: null,
      parent_task_id: null,
    });
  });

  it("requires a title", () => {
    expect(quickTaskSchema.safeParse({ title: "  " }).success).toBe(false);
  });
});

describe("taskEditSchema", () => {
  const base = {
    title: "Task",
    status: "todo",
    priority: "medium",
    recurrence_frequency: "none",
    recurrence_weekdays: [],
  };

  it("drops weekdays and end dates that do not apply", () => {
    const daily = taskEditSchema.parse({
      ...base,
      due_date: "2026-10-12",
      recurrence_frequency: "daily",
      recurrence_weekdays: ["1", "3"],
    });
    expect(daily.recurrence_weekdays).toBeNull();
    expect(daily.recurrence_interval).toBe(1);

    const weekly = taskEditSchema.parse({
      ...base,
      due_date: "2026-10-12",
      recurrence_frequency: "weekly",
      recurrence_weekdays: ["5", "1", "5"],
    });
    expect(weekly.recurrence_weekdays).toEqual([1, 5]);

    const none = taskEditSchema.parse({ ...base, recurrence_until: "2026-12-31" });
    expect(none.recurrence_frequency).toBeNull();
    expect(none.recurrence_until).toBeNull();
  });

  it("requires a due date for recurrence and due time", () => {
    const recurring = taskEditSchema.safeParse({ ...base, recurrence_frequency: "daily" });
    expect(recurring.success).toBe(false);
    const timed = taskEditSchema.safeParse({ ...base, due_time: "09:00" });
    expect(timed.success).toBe(false);
  });

  it("rejects an end date before the due date", () => {
    const result = taskEditSchema.safeParse({
      ...base,
      due_date: "2026-10-12",
      recurrence_frequency: "daily",
      recurrence_until: "2026-10-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("parseTagNames", () => {
  it("trims, drops blanks, and de-duplicates case-insensitively", () => {
    expect(parseTagNames(" Deep work, errands,,deep WORK , ")).toEqual(["Deep work", "errands"]);
    expect(parseTagNames(null)).toEqual([]);
  });
});
