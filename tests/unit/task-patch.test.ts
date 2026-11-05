import { describe, expect, it } from "vitest";
import { mergeTaskPatch, type PatchSourceRow } from "@/features/tasks/patch";

const row: PatchSourceRow = {
  title: "Write first issue",
  description: null,
  status: "todo",
  priority: "medium",
  due_date: "2026-11-10",
  due_time: "09:30:00",
  estimate_minutes: 45,
  project_id: null,
  area_id: null,
  recurrence_frequency: null,
  recurrence_interval: 1,
  recurrence_until: null,
  recurrence_weekdays: null,
};

const ok = (patch: unknown, base = row) => {
  const result = mergeTaskPatch(base, patch);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.data;
};

describe("mergeTaskPatch", () => {
  it("changes only the patched field and keeps the rest of the stored task", () => {
    const data = ok({ priority: "high" });
    expect(data).toMatchObject({
      title: "Write first issue",
      priority: "high",
      due_date: "2026-11-10",
      due_time: "09:30",
      estimate_minutes: 45,
      recurrence_frequency: null,
    });
  });

  it("clears optional fields with an empty string", () => {
    expect(ok({ estimate_minutes: "" }).estimate_minutes).toBeNull();
    expect(ok({ due_time: "" }).due_time).toBeNull();
  });

  it("keeps cross-field rules: no due time without a due date", () => {
    const result = mergeTaskPatch(row, { due_date: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Add a due date first.");
    // Removing the time as well is fine.
    expect(ok({ due_date: "", due_time: "" }).due_date).toBeNull();
  });

  it("keeps cross-field rules: a repeating task needs a due date, and a valid end", () => {
    const noDue = { ...row, due_date: null, due_time: null };
    const result = mergeTaskPatch(noDue, { recurrence_frequency: "weekly" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/need a due date/);

    const ending = mergeTaskPatch(row, {
      recurrence_frequency: "daily",
      recurrence_until: "2026-11-01",
    });
    expect(ending.ok).toBe(false);

    const weekly = ok({ recurrence_frequency: "weekly", recurrence_weekdays: ["3", "1", "1"] });
    expect(weekly.recurrence_weekdays).toEqual([1, 3]);
  });

  it("drops weekdays and the end date when the task stops repeating", () => {
    const repeating: PatchSourceRow = {
      ...row,
      recurrence_frequency: "weekly",
      recurrence_weekdays: [1, 3],
      recurrence_until: "2026-12-31",
    };
    const data = ok({ recurrence_frequency: "none" }, repeating);
    expect(data.recurrence_frequency).toBeNull();
    expect(data.recurrence_weekdays).toBeNull();
    expect(data.recurrence_until).toBeNull();
  });

  it("rejects unknown fields, wrong types, and invalid values", () => {
    expect(mergeTaskPatch(row, { workspace_id: "x" }).ok).toBe(false);
    expect(mergeTaskPatch(row, { priority: 3 }).ok).toBe(false);
    expect(mergeTaskPatch(row, { priority: "extreme" }).ok).toBe(false);
    expect(mergeTaskPatch(row, { title: "   " }).ok).toBe(false);
    expect(mergeTaskPatch(row, { project_id: "not-a-uuid" }).ok).toBe(false);
    expect(mergeTaskPatch(row, null).ok).toBe(false);
  });
});
