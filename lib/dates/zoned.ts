import { DateTime } from "luxon";
import type { IsoDate } from "./index";

/**
 * Conversions between UTC instants and wall-clock times in an IANA timezone. Luxon handles
 * daylight-saving transitions: days can be 23 or 25 hours long, and wall times inside a "spring
 * forward" gap move to the next valid time.
 */

export type ZonedRange = { start: string; end: string };

function zoned(date: IsoDate, timeZone: string) {
  const dt = DateTime.fromISO(date, { zone: timeZone });
  if (!dt.isValid) throw new Error(`Invalid date or timezone: ${date} ${timeZone}`);
  return dt;
}

/** UTC instants of local midnight on `from` and on `toExclusive`. */
export function zonedRange(from: IsoDate, toExclusive: IsoDate, timeZone: string): ZonedRange {
  return {
    start: zoned(from, timeZone).startOf("day").toUTC().toISO()!,
    end: zoned(toExclusive, timeZone).startOf("day").toUTC().toISO()!,
  };
}

export function zonedDayRange(date: IsoDate, timeZone: string): ZonedRange {
  const start = zoned(date, timeZone).startOf("day");
  return { start: start.toUTC().toISO()!, end: start.plus({ days: 1 }).toUTC().toISO()! };
}

/** The UTC instant of a local wall-clock time, e.g. ("2026-10-14", "09:30", "Asia/Tokyo"). */
export function localToInstant(date: IsoDate, time: string, timeZone: string): string {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: timeZone });
  if (!dt.isValid) throw new Error(`Invalid local time: ${date} ${time} ${timeZone}`);
  return dt.toUTC().toISO()!;
}

/** Local date and HH:mm of an instant in a timezone. */
export function instantToLocal(instant: string, timeZone: string): { date: IsoDate; time: string } {
  const dt = DateTime.fromISO(instant, { zone: "utc" }).setZone(timeZone);
  return { date: dt.toISODate()!, time: dt.toFormat("HH:mm") };
}

/** "09:00–10:30" in the given timezone. */
export function formatTimeRange(start: string, end: string, timeZone: string): string {
  const s = instantToLocal(start, timeZone);
  const e = instantToLocal(end, timeZone);
  return s.date === e.date ? `${s.time}–${e.time}` : `${s.time}–${e.time} (+1 day)`;
}

export function minutesBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
}

/** ISO-8601 week number of a date. */
export function isoWeekNumber(date: IsoDate): number {
  return DateTime.fromISO(date, { zone: "utc" }).weekNumber;
}

/** Hours in the local day (23 or 25 on daylight-saving changes). */
export function hoursInLocalDay(date: IsoDate, timeZone: string): number {
  const { start, end } = zonedDayRange(date, timeZone);
  return minutesBetween(start, end) / 60;
}
