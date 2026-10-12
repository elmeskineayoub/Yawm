import type { IsoDate } from "@/lib/dates";
import type { Database } from "@/types/database";

export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type RecurrenceFrequency = Database["public"]["Enums"]["recurrence_frequency"];

export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];
export const TASK_PRIORITIES: readonly TaskPriority[] = ["urgent", "high", "medium", "low"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function isOpen(status: TaskStatus): boolean {
  return status === "todo" || status === "in_progress";
}

/** Only unfinished tasks can be overdue; a date-only deadline is due through the end of that day. */
export function isOverdue(
  task: { status: TaskStatus; due_date: IsoDate | null },
  today: IsoDate,
): boolean {
  return isOpen(task.status) && task.due_date !== null && task.due_date < today;
}

export type ProgressSummary = { done: number; total: number; percent: number };

/** Completion ratio. Cancelled tasks are excluded from both sides. */
export function progressOf(tasks: readonly { status: TaskStatus }[]): ProgressSummary {
  const counted = tasks.filter((t) => t.status !== "cancelled");
  const done = counted.filter((t) => t.status === "done").length;
  const total = counted.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export type SortKey = "due" | "priority" | "created" | "title";

type Sortable = {
  title: string;
  priority: TaskPriority;
  due_date: IsoDate | null;
  due_time: string | null;
  created_at: string;
};

/** Stable comparator; tasks without a due date sort after dated ones. */
export function compareTasks(sort: SortKey) {
  return (a: Sortable, b: Sortable): number => {
    const byDue = () => {
      if (a.due_date === b.due_date) return (a.due_time ?? "99").localeCompare(b.due_time ?? "99");
      if (a.due_date === null) return 1;
      if (b.due_date === null) return -1;
      return a.due_date.localeCompare(b.due_date);
    };
    const byPriority = () => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    switch (sort) {
      case "due":
        return byDue() || byPriority() || a.title.localeCompare(b.title);
      case "priority":
        return byPriority() || byDue() || a.title.localeCompare(b.title);
      case "created":
        return b.created_at.localeCompare(a.created_at);
      case "title":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    }
  };
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type RecurrenceRule = {
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number;
  recurrence_weekdays: number[] | null;
  recurrence_until: IsoDate | null;
  recurrence_anchor?: IsoDate | null;
  due_date?: IsoDate | null;
};

/** Human-readable rule, e.g. "Every 2 weeks on Mon, Wed until Dec 31". */
export function describeRecurrence(rule: RecurrenceRule): string | null {
  const { recurrence_frequency: frequency, recurrence_interval: every } = rule;
  if (!frequency) return null;
  const unit = { daily: "day", weekly: "week", monthly: "month" }[frequency];
  let text = every === 1 ? `Every ${unit}` : `Every ${every} ${unit}s`;
  if (frequency === "weekly" && rule.recurrence_weekdays?.length) {
    const days = [...rule.recurrence_weekdays].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7));
    text += ` on ${days.map((d) => WEEKDAY_NAMES[d]).join(", ")}`;
  }
  const anchor = rule.recurrence_anchor ?? rule.due_date;
  if (frequency === "monthly" && anchor) {
    text += ` on day ${Number(anchor.slice(8, 10))}`;
  }
  if (rule.recurrence_until) text += ` until ${rule.recurrence_until}`;
  return text;
}

/** Maps database rule errors raised by triggers to messages for the UI. */
export function friendlyTaskError(message: string | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("TASK_BLOCKED"))
    return "This task depends on unfinished tasks. Finish or cancel those first.";
  if (message.includes("DEPENDENCY_CYCLE")) return "That would create a circular dependency.";
  if (message.includes("SUBTASK_DEPTH")) return "Subtasks can only be one level deep.";
  return "Something went wrong. Please try again.";
}
