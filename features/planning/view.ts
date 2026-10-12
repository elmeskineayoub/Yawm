import { isIsoDate, periodStart, type IsoDate, type PlanPeriod } from "@/lib/dates";

export const PLANNER_VIEWS: readonly PlanPeriod[] = ["day", "week", "month", "year"];

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Reads `/planner?view=…&date=…`. The Phase 2 `period` parameter is still accepted so old links
 * keep working. Any date inside the period is normalised to the period's start.
 */
export function parsePlannerParams(
  params: Params,
  today: IsoDate,
  weekStart: number,
): { view: PlanPeriod; date: IsoDate; start: IsoDate } {
  const raw = first(params.view) ?? first(params.period);
  const view = PLANNER_VIEWS.includes(raw as PlanPeriod) ? (raw as PlanPeriod) : "week";
  const rawDate = first(params.date);
  const date = rawDate && isIsoDate(rawDate) ? rawDate : today;
  return { view, date, start: periodStart(view, date, weekStart) };
}

export function plannerHref(view: PlanPeriod, date: IsoDate): string {
  return `/planner?view=${view}&date=${date}`;
}
