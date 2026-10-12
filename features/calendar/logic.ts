import { addDays, periodEnd, periodStart, type IsoDate, type PlanPeriod } from "@/lib/dates";
import { isOpen, type TaskStatus } from "@/features/tasks/logic";

export type BlockSpan = { id: string; starts_at: string; ends_at: string };

const ms = (iso: string) => Date.parse(iso);

/** Two spans overlap when each starts before the other ends; touching edges do not overlap. */
export function spansOverlap(a: Omit<BlockSpan, "id">, b: Omit<BlockSpan, "id">): boolean {
  return ms(a.starts_at) < ms(b.ends_at) && ms(b.starts_at) < ms(a.ends_at);
}

/** Blocks among `others` that overlap `span`, excluding `span` itself. */
export function overlapsWith<T extends BlockSpan>(
  span: Omit<BlockSpan, "id"> & { id?: string },
  others: readonly T[],
): T[] {
  return others.filter((o) => o.id !== span.id && spansOverlap(span, o));
}

/** IDs of every block that overlaps at least one other block (sweep line, O(n log n)). */
export function overlappingIds(blocks: readonly BlockSpan[]): Set<string> {
  const sorted = [...blocks].sort((a, b) => ms(a.starts_at) - ms(b.starts_at));
  const result = new Set<string>();
  let active: BlockSpan[] = [];
  for (const block of sorted) {
    active = active.filter((a) => ms(a.ends_at) > ms(block.starts_at));
    for (const a of active) {
      result.add(a.id);
      result.add(block.id);
    }
    active.push(block);
  }
  return result;
}

type TaskLike = { id: string; status: TaskStatus; due_date: IsoDate | null };
type BlockOfTask = { task_id: string | null; starts_at: string; ends_at: string };

/** Open tasks with no block that is still upcoming or in progress at `now`. */
export function unscheduledTasks<T extends TaskLike>(
  tasks: readonly T[],
  blocks: readonly BlockOfTask[],
  now: Date,
): T[] {
  const scheduled = new Set(
    blocks.filter((b) => b.task_id && ms(b.ends_at) > now.getTime()).map((b) => b.task_id!),
  );
  return tasks.filter((t) => isOpen(t.status) && !scheduled.has(t.id));
}

export type RescheduleReason = "missed_block" | "overdue";

/**
 * Unfinished work that needs a decision: open tasks whose scheduled time has passed with no
 * future block, and open tasks whose deadline is before today. Nothing is moved automatically.
 */
export function needsRescheduling<T extends TaskLike>(
  tasks: readonly T[],
  blocks: readonly BlockOfTask[],
  now: Date,
  today: IsoDate,
): { task: T; reasons: RescheduleReason[] }[] {
  const past = new Set<string>();
  const future = new Set<string>();
  for (const b of blocks) {
    if (!b.task_id) continue;
    (ms(b.ends_at) > now.getTime() ? future : past).add(b.task_id);
  }
  return tasks.flatMap((task) => {
    if (!isOpen(task.status)) return [];
    const reasons: RescheduleReason[] = [];
    if (past.has(task.id) && !future.has(task.id)) reasons.push("missed_block");
    if (task.due_date !== null && task.due_date < today) reasons.push("overdue");
    return reasons.length ? [{ task, reasons }] : [];
  });
}

/** Block length for a dragged task: its estimate (15 min – 8 h), or 30 minutes. */
export function defaultBlockMinutes(estimate: number | null): number {
  if (!estimate) return 30;
  return Math.min(480, Math.max(15, Math.round(estimate / 15) * 15));
}

/** Dates the calendar grid shows for a period (whole weeks around a month). */
export function visibleDates(
  period: PlanPeriod,
  start: IsoDate,
  weekStart: number,
): { from: IsoDate; to: IsoDate } {
  const end = periodEnd(period, start);
  if (period === "month") {
    const from = periodStart("week", start, weekStart);
    const lastDay = addDays(end, -1);
    return { from, to: addDays(periodStart("week", lastDay, weekStart), 7) };
  }
  return { from: start, to: end };
}
