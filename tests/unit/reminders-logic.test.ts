import { describe, expect, it } from "vitest";
import {
  buildReminders,
  DEFAULT_REMINDER_PREFS,
  habitReminderKey,
  taskReminderKey,
  type ReminderSources,
} from "@/features/reminders/logic";

const base: ReminderSources = {
  today: "2026-10-12",
  overdueTasks: [{ id: "t1", title: "Overdue task", due_date: "2026-10-10" }],
  dueTodayTasks: [{ id: "t2", title: "Due task", due_date: "2026-10-12" }],
  habits: [{ id: "h1", title: "Read" }],
  blocks: [{ id: "b1", title: "Deep work", time: "09:00" }],
  dismissed: new Set(),
  prefs: DEFAULT_REMINDER_PREFS,
};

describe("buildReminders", () => {
  it("lists tasks (overdue first), then habits, then blocks, with stable keys", () => {
    const reminders = buildReminders(base);
    expect(reminders.map((r) => r.key)).toEqual([
      taskReminderKey("t1"),
      taskReminderKey("t2"),
      habitReminderKey("h1", "2026-10-12"),
      "block:b1",
    ]);
    expect(reminders[0]!.detail).toContain("Overdue");
    expect(reminders[1]!.detail).toBe("Due today");
    expect(reminders[3]!.detail).toBe("Starts at 09:00");
    expect(reminders[0]!.href).toBe("/tasks/t1");
  });

  it("hides dismissed reminders", () => {
    const reminders = buildReminders({
      ...base,
      dismissed: new Set([taskReminderKey("t1"), habitReminderKey("h1", "2026-10-12")]),
    });
    expect(reminders.map((r) => r.key)).toEqual([taskReminderKey("t2"), "block:b1"]);
  });

  it("drops whole categories that are switched off", () => {
    const reminders = buildReminders({
      ...base,
      prefs: { task: false, habit: true, time_block: false },
    });
    expect(reminders.map((r) => r.category)).toEqual(["habit"]);
  });

  it("is empty when nothing is due", () => {
    expect(
      buildReminders({
        ...base,
        overdueTasks: [],
        dueTodayTasks: [],
        habits: [],
        blocks: [],
      }),
    ).toEqual([]);
  });
});
