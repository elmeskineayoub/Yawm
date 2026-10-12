import { formatDate, type IsoDate } from "@/lib/dates";

/**
 * Pure logic for the in-app reminder centre. Reminders are derived from data that already exists
 * and each has a *stable key*, so a reminder the user dismissed never reappears on refresh and the
 * same underlying item is never shown twice (REQUIREMENTS 6.13). Nothing here promises reminders
 * while the app is closed.
 */

export type ReminderCategory = "task" | "habit" | "time_block";

export type Reminder = {
  key: string;
  category: ReminderCategory;
  title: string;
  detail: string | null;
  href: string;
};

export type ReminderPrefs = Record<ReminderCategory, boolean>;

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  task: true,
  habit: true,
  time_block: true,
};

export const REMINDER_CATEGORY_LABELS: Record<ReminderCategory, string> = {
  task: "Task deadlines",
  habit: "Habits",
  time_block: "Scheduled time blocks",
};

// Stable keys. A task keeps one key regardless of date; habits and nothing-dated-yet items are
// scoped by date so they can recur day to day.
export const taskReminderKey = (id: string) => `task:${id}`;
export const habitReminderKey = (id: string, date: IsoDate) => `habit:${id}:${date}`;
export const blockReminderKey = (id: string) => `block:${id}`;

export type TaskReminderSource = { id: string; title: string; due_date: IsoDate };
export type HabitReminderSource = { id: string; title: string };
export type BlockReminderSource = { id: string; title: string; time: string };

export type ReminderSources = {
  today: IsoDate;
  overdueTasks: readonly TaskReminderSource[];
  dueTodayTasks: readonly TaskReminderSource[];
  habits: readonly HabitReminderSource[];
  blocks: readonly BlockReminderSource[];
  dismissed: ReadonlySet<string>;
  prefs: ReminderPrefs;
};

/** Builds the visible reminder list: enabled categories only, with dismissed keys removed. */
export function buildReminders(sources: ReminderSources): Reminder[] {
  const { today, prefs, dismissed } = sources;
  const out: Reminder[] = [];

  if (prefs.task) {
    for (const t of sources.overdueTasks) {
      out.push({
        key: taskReminderKey(t.id),
        category: "task",
        title: t.title,
        detail: `Overdue — was due ${formatDate(t.due_date, "short")}`,
        href: `/tasks/${t.id}`,
      });
    }
    for (const t of sources.dueTodayTasks) {
      out.push({
        key: taskReminderKey(t.id),
        category: "task",
        title: t.title,
        detail: "Due today",
        href: `/tasks/${t.id}`,
      });
    }
  }

  if (prefs.habit) {
    for (const h of sources.habits) {
      out.push({
        key: habitReminderKey(h.id, today),
        category: "habit",
        title: h.title,
        detail: "Habit due today",
        href: `/habits/${h.id}`,
      });
    }
  }

  if (prefs.time_block) {
    for (const b of sources.blocks) {
      out.push({
        key: blockReminderKey(b.id),
        category: "time_block",
        title: b.title,
        detail: `Starts at ${b.time}`,
        href: "/planner",
      });
    }
  }

  return out.filter((r) => !dismissed.has(r.key));
}
