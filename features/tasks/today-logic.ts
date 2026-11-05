import type { IsoDate } from "@/lib/dates";
import { instantToLocal, localToInstant, minutesBetween } from "@/lib/dates/zoned";

/*
 * Pure helpers for the Today page: the day's agenda (scheduled blocks, timed deadlines, free gaps,
 * and where "now" falls) and a one-sentence summary. Kept free of React and the database so the
 * time arithmetic is easy to test across timezones.
 */

export type AgendaBlock = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  task: { id: string; status: string } | null;
};
export type AgendaDeadline = { id: string; title: string; due_time: string; status: string };

export type AgendaItem =
  | {
      kind: "block";
      id: string;
      title: string;
      start: string;
      end: string;
      taskId: string | null;
      done: boolean;
      state: "past" | "current" | "upcoming";
    }
  | { kind: "deadline"; id: string; title: string; at: string; done: boolean; past: boolean }
  | { kind: "gap"; start: string; end: string; minutes: number }
  | { kind: "now"; at: string };

/** Free time shorter than this is not worth showing as a gap. */
export const MIN_GAP_MINUTES = 30;

/**
 * Builds today's agenda in time order. Free gaps are shown only between things still to come
 * (past free time is not actionable), and the "now" marker sits where the current time falls.
 */
export function buildDayAgenda({
  blocks,
  deadlines,
  today,
  timezone,
  now,
}: {
  blocks: AgendaBlock[];
  deadlines: AgendaDeadline[];
  today: IsoDate;
  timezone: string;
  now: Date;
}): AgendaItem[] {
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const timed: (AgendaItem & { sortAt: number })[] = [
    ...blocks.map((b) => {
      const start = Date.parse(b.starts_at);
      const end = Date.parse(b.ends_at);
      return {
        kind: "block" as const,
        id: b.id,
        title: b.title,
        start: b.starts_at,
        end: b.ends_at,
        taskId: b.task?.id ?? null,
        done: b.task?.status === "done",
        state: (end <= nowMs ? "past" : start <= nowMs ? "current" : "upcoming") as
          "past" | "current" | "upcoming",
        sortAt: start,
      };
    }),
    ...deadlines.map((d) => {
      const at = localToInstant(today, d.due_time.slice(0, 5), timezone);
      return {
        kind: "deadline" as const,
        id: d.id,
        title: d.title,
        at,
        done: d.status === "done",
        past: Date.parse(at) <= nowMs,
        sortAt: Date.parse(at),
      };
    }),
  ].sort((a, b) => a.sortAt - b.sortAt);

  const items: AgendaItem[] = [];
  const nowIsToday = instantToLocal(nowIso, timezone).date === today;
  let nowPlaced = !nowIsToday;
  // Free time starts at whichever is later: the end of the last block, or now.
  let freeFrom: number | null = nowIsToday ? nowMs : null;

  for (const entry of timed) {
    const { sortAt, ...item } = entry;
    if (!nowPlaced && sortAt > nowMs) {
      items.push({ kind: "now", at: nowIso });
      nowPlaced = true;
    }
    if (item.kind === "block") {
      const start = Date.parse(item.start);
      if (freeFrom !== null && start - freeFrom >= MIN_GAP_MINUTES * 60_000 && start > nowMs) {
        const gapStart = new Date(Math.max(freeFrom, nowMs)).toISOString();
        items.push({
          kind: "gap",
          start: gapStart,
          end: item.start,
          minutes: minutesBetween(gapStart, item.start),
        });
      }
      const end = Date.parse(item.end);
      freeFrom = freeFrom === null ? end : Math.max(freeFrom, end);
    }
    items.push(item);
  }
  if (!nowPlaced) items.push({ kind: "now", at: nowIso });
  return items;
}

/** "1h 30m", "45m", "2h". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * One plain sentence about the day, computed from the user's own data (no AI): what is overdue,
 * what is due, habit progress, and what is next on the schedule.
 */
export function summarizeToday({
  overdue,
  dueToday,
  completedToday,
  habitsDone,
  habitsDue,
  next,
  scheduledToday = 0,
}: {
  overdue: number;
  dueToday: number;
  completedToday: number;
  habitsDone: number;
  habitsDue: number;
  next: { title: string; time: string } | null;
  /** Blocks on today's schedule (past ones included), to tell "nothing" from "nothing else". */
  scheduledToday?: number;
}): string {
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (dueToday > 0) parts.push(`${dueToday} due today`);
  else if (overdue === 0) parts.push(completedToday > 0 ? "nothing else due" : "nothing due");
  if (completedToday > 0) parts.push(`${completedToday} done`);
  if (habitsDue > 0)
    parts.push(`${habitsDone} of ${habitsDue} habit${habitsDue === 1 ? "" : "s"} done`);
  parts.push(
    next
      ? `next up: ${next.title} at ${next.time}`
      : scheduledToday > 0
        ? "nothing else scheduled"
        : "nothing scheduled",
  );
  const sentence = parts.join(", ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
