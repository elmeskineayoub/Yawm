import { addDays, dayOfWeek, periodStart, type IsoDate } from "@/lib/dates";

/**
 * Habit schedules, streaks, and completion rates. Everything is derived from habit rows and
 * logs; nothing here is stored. Dates are date-only values in the user's timezone, and "today"
 * comes from the caller (todayIn(profile timezone)), so daylight-saving changes can't shift a day.
 *
 * Rules
 * - Daily habits are due on their listed ISO weekdays; other weekdays are rest days.
 * - Weekly habits are due `times_per_week` times per week (the user's week start), on any days.
 * - An explicit rest log excuses a day: it never counts as a miss. For weekly habits each rest
 *   day lowers that week's target by one.
 * - Today (or the current week) never breaks a streak while it can still be completed.
 * - Days outside the active period (starts_on … ends_on) don't count at all.
 */

export type HabitKind = "boolean" | "measurable";
export type HabitFrequency = "daily" | "weekly";

export type HabitRule = {
  kind: HabitKind;
  target_value: number | null;
  frequency: HabitFrequency;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  times_per_week: number | null;
  starts_on: IsoDate;
  ends_on: IsoDate | null;
};

export type HabitLog = { log_date: IsoDate; value: number | null; rest: boolean };

export type DayStatus =
  /** Completed. */
  | "done"
  /** An explicit rest day, or a weekday the habit isn't scheduled on. */
  | "rest"
  /** Due, in the past, and not completed. */
  | "missed"
  /** Not completed, and not a miss: today or later, or any day of a weekly habit. */
  | "open"
  /** Outside the active period. */
  | "inactive";

/** ISO weekday (1 = Monday … 7 = Sunday). */
export function isoWeekday(date: IsoDate): number {
  return dayOfWeek(date) || 7;
}

export function isActiveOn(habit: HabitRule, date: IsoDate): boolean {
  return date >= habit.starts_on && (habit.ends_on === null || date <= habit.ends_on);
}

/** Whether the habit can be done on this day (daily: a listed weekday; weekly: any active day). */
export function isScheduledOn(habit: HabitRule, date: IsoDate): boolean {
  if (!isActiveOn(habit, date)) return false;
  return habit.frequency === "weekly" || habit.weekdays.includes(isoWeekday(date));
}

/** A log counts as done when it isn't a rest day and reaches the target (1 for boolean habits). */
export function isDone(habit: HabitRule, log: HabitLog | undefined): boolean {
  if (!log || log.rest || log.value === null) return false;
  return log.value >= (habit.kind === "measurable" ? (habit.target_value ?? 1) : 1);
}

function byDate(logs: readonly HabitLog[]): Map<IsoDate, HabitLog> {
  return new Map(logs.map((l) => [l.log_date, l]));
}

/** Status of one day. Weekly habits are judged per week (weekProgress), so their days are never "missed". */
export function dayStatus(
  habit: HabitRule,
  date: IsoDate,
  log: HabitLog | undefined,
  today: IsoDate,
): DayStatus {
  if (!isActiveOn(habit, date)) return "inactive";
  if (isDone(habit, log)) return "done";
  if (log?.rest || !isScheduledOn(habit, date)) return "rest";
  // A weekly habit's single undone day isn't a miss; only the week can be missed.
  if (habit.frequency === "weekly") return "open";
  return date >= today ? "open" : "missed";
}

export type WeekProgress = {
  weekStart: IsoDate;
  done: number;
  /** Completions needed this week after rest days and inactive days; 0 means a rest week. */
  target: number;
  met: boolean;
  /** The week contains today (or is later), so it can still be met. */
  current: boolean;
};

/** Progress of a weekly habit in the week starting `weekStart`. */
export function weekProgress(
  habit: HabitRule,
  weekStart: IsoDate,
  logs: Map<IsoDate, HabitLog>,
  today: IsoDate,
): WeekProgress {
  let done = 0;
  let rest = 0;
  let activeDays = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    if (!isActiveOn(habit, date)) continue;
    activeDays++;
    const log = logs.get(date);
    if (isDone(habit, log)) done++;
    else if (log?.rest) rest++;
  }
  const target = Math.max(0, Math.min(habit.times_per_week ?? 1, activeDays) - rest);
  return {
    weekStart,
    done,
    target,
    met: target > 0 && done >= target,
    current: addDays(weekStart, 6) >= today,
  };
}

export type Streaks = {
  current: number;
  longest: number;
  /** "day" for daily habits, "week" for weekly ones. */
  unit: "day" | "week";
};

/**
 * Current and longest streaks, up to `today`. Rest days (and rest weeks) are skipped: they
 * neither extend nor break a streak. Editing any past log simply changes the inputs.
 */
export function streaks(
  habit: HabitRule,
  logs: readonly HabitLog[],
  today: IsoDate,
  weekStart = 1,
): Streaks {
  const map = byDate(logs);
  const end = habit.ends_on !== null && habit.ends_on < today ? habit.ends_on : today;
  if (end < habit.starts_on) {
    return { current: 0, longest: 0, unit: habit.frequency === "weekly" ? "week" : "day" };
  }

  // Each unit (day or week) is "done", "skip" (rest, or still open), or "miss".
  const units: ("done" | "skip" | "miss")[] = [];
  if (habit.frequency === "daily") {
    for (let date = habit.starts_on; date <= end; date = addDays(date, 1)) {
      const status = dayStatus(habit, date, map.get(date), today);
      units.push(status === "done" ? "done" : status === "missed" ? "miss" : "skip");
    }
  } else {
    for (
      let start = periodStart("week", habit.starts_on, weekStart);
      start <= end;
      start = addDays(start, 7)
    ) {
      const week = weekProgress(habit, start, map, today);
      units.push(week.met ? "done" : week.target === 0 || week.current ? "skip" : "miss");
    }
  }

  let longest = 0;
  let run = 0;
  for (const unit of units) {
    if (unit === "done") longest = Math.max(longest, ++run);
    else if (unit === "miss") run = 0;
  }
  let current = 0;
  for (let i = units.length - 1; i >= 0; i--) {
    if (units[i] === "miss") break;
    if (units[i] === "done") current++;
  }
  return { current, longest, unit: habit.frequency === "weekly" ? "week" : "day" };
}

export type CompletionRate = {
  done: number;
  /** Days (or weekly completions) that were due. Rest days and open days are excluded. */
  due: number;
  /** null when nothing was due. */
  rate: number | null;
};

/**
 * Share of due occurrences completed in [from, to] (inclusive), counted only up to today.
 * Daily: completed due days / due days (today counts only once done). Weekly: completions, capped
 * at each week's target, / targets — the current week counts only once met.
 */
export function completionRate(
  habit: HabitRule,
  logs: readonly HabitLog[],
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
  weekStart = 1,
): CompletionRate {
  const map = byDate(logs);
  const last = to < today ? to : today;
  let done = 0;
  let due = 0;
  if (habit.frequency === "daily") {
    for (let date = from; date <= last; date = addDays(date, 1)) {
      const status = dayStatus(habit, date, map.get(date), today);
      if (status === "done") {
        done++;
        due++;
      } else if (status === "missed") due++;
    }
  } else {
    for (
      let start = periodStart("week", from, weekStart);
      start <= last;
      start = addDays(start, 7)
    ) {
      const week = weekProgress(habit, start, map, today);
      if (week.target === 0 || (week.current && !week.met)) continue;
      done += Math.min(week.done, week.target);
      due += week.target;
    }
  }
  return { done, due, rate: due === 0 ? null : done / due };
}

/** Habits due today: daily habits scheduled today; weekly habits whose week isn't met yet. */
export function isDueOn(
  habit: HabitRule,
  logs: readonly HabitLog[],
  date: IsoDate,
  weekStart = 1,
): boolean {
  if (!isScheduledOn(habit, date)) return false;
  if (habit.frequency === "daily") return true;
  const week = weekProgress(habit, periodStart("week", date, weekStart), byDate(logs), date);
  return week.target > 0 && (!week.met || isDone(habit, byDate(logs).get(date)));
}

/** Plain-language schedule, e.g. "Every day", "Mon, Wed, Fri", "3× a week". */
export function describeSchedule(
  habit: Pick<HabitRule, "frequency" | "weekdays" | "times_per_week">,
): string {
  if (habit.frequency === "weekly") return `${habit.times_per_week ?? 1}× a week`;
  const days = [...habit.weekdays].sort();
  if (days.length === 7) return "Every day";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  if (days.join() === "6,7") return "Weekends";
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((d) => names[d - 1]).join(", ");
}

/** "5-day streak", "2-week streak", or "No streak yet". */
export function streakText({ current, unit }: Pick<Streaks, "current" | "unit">): string {
  return current === 0 ? "No streak yet" : `${current}-${unit} streak`;
}
