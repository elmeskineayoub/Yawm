/**
 * Date-only helpers. A date-only value is an ISO `YYYY-MM-DD` string with no time or zone; it is
 * interpreted in the user's IANA timezone. Arithmetic runs on UTC midnights so daylight-saving
 * changes never shift a date.
 */

export type IsoDate = string;
export type PlanPeriod = "year" | "month" | "week" | "day";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtc(date: IsoDate): Date {
  if (!isIsoDate(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** The calendar date "now" in the given timezone (e.g. 23:30 UTC is already tomorrow in Tokyo). */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Adds months, clamping to the end of shorter months (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = toUtc(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUtc(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  return toUtc(date).getUTCDay();
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Start of the period containing `date`. Weeks start on `weekStart` (0 = Sunday). */
export function periodStart(period: PlanPeriod, date: IsoDate, weekStart = 1): IsoDate {
  switch (period) {
    case "year":
      return `${date.slice(0, 4)}-01-01`;
    case "month":
      return `${date.slice(0, 7)}-01`;
    case "week":
      return addDays(date, -((dayOfWeek(date) - weekStart + 7) % 7));
    case "day":
      return date;
  }
}

/** Exclusive end of the period that starts at `start`. */
export function periodEnd(period: PlanPeriod, start: IsoDate): IsoDate {
  switch (period) {
    case "year":
      return addMonths(start, 12);
    case "month":
      return addMonths(start, 1);
    case "week":
      return addDays(start, 7);
    case "day":
      return addDays(start, 1);
  }
}

export function shiftPeriod(period: PlanPeriod, start: IsoDate, steps: number): IsoDate {
  switch (period) {
    case "year":
      return addMonths(start, 12 * steps);
    case "month":
      return addMonths(start, steps);
    case "week":
      return addDays(start, 7 * steps);
    case "day":
      return addDays(start, steps);
  }
}

export const PARENT_PERIOD: Record<PlanPeriod, PlanPeriod | null> = {
  year: null,
  month: "year",
  week: "month",
  day: "week",
};

export const CHILD_PERIOD: Record<PlanPeriod, PlanPeriod | null> = {
  year: "month",
  month: "week",
  week: "day",
  day: null,
};

const formatters = {
  long: new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  short: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
  month: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }),
};

export function formatDate(date: IsoDate, style: "long" | "short" = "long"): string {
  return formatters[style].format(toUtc(date));
}

export function formatPeriod(period: PlanPeriod, start: IsoDate): string {
  switch (period) {
    case "year":
      return start.slice(0, 4);
    case "month":
      return formatters.month.format(toUtc(start));
    case "week":
      return `Week of ${formatDate(start)}`;
    case "day":
      return formatDate(start);
  }
}

/** "Today", "Tomorrow", "Yesterday", or a short date, relative to `today`. */
export function relativeDateLabel(date: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return date.slice(0, 4) === today.slice(0, 4) ? formatDate(date, "short") : formatDate(date);
}

/** The calendar date of a UTC instant (e.g. `created_at`) in the user's timezone. */
export function dateOfInstant(instant: string, timeZone: string): IsoDate {
  return todayIn(timeZone, new Date(instant));
}
