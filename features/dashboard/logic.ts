import { addDays, daysBetween, type IsoDate } from "@/lib/dates";
import { JOURNAL_PROMPTS } from "@/features/journal/logic";

/**
 * Pure dashboard helpers. The dashboard's figures are derived from source rows; these functions
 * only shape them and keep date ranges explicit (REQUIREMENTS 6.1), without any charting library.
 */

export type DayCount = { date: IsoDate; count: number };

/**
 * Buckets a list of (already timezone-local) dates into `days` contiguous daily counts starting at
 * `startDate`, oldest first. Dates outside the window are ignored.
 */
export function bucketByDay(
  dates: readonly IsoDate[],
  startDate: IsoDate,
  days: number,
): DayCount[] {
  const buckets: DayCount[] = Array.from({ length: days }, (_, i) => ({
    date: addDays(startDate, i),
    count: 0,
  }));
  const index = new Map(buckets.map((b, i) => [b.date, i]));
  for (const date of dates) {
    const i = index.get(date);
    if (i !== undefined) buckets[i]!.count += 1;
  }
  return buckets;
}

/** A whole-percentage completion rate from done and the still-open total, or null when nothing is due. */
export function completionRate(done: number, open: number): number | null {
  const total = done + open;
  return total === 0 ? null : Math.round((done / total) * 100);
}

/** A stable reflection prompt for the day, rotating through the journal prompts. */
export function dailyPrompt(today: IsoDate, prompts: readonly string[] = JOURNAL_PROMPTS): string {
  const n = prompts.length;
  if (n === 0) return "";
  const index = ((daysBetween("1970-01-01", today) % n) + n) % n;
  return prompts[index]!;
}
