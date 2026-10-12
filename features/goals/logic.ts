import { progressOf, type ProgressSummary } from "@/features/tasks/logic";
import type { TaskStatus } from "@/features/tasks/logic";
import type { IsoDate } from "@/lib/dates";

/**
 * Goal progress, always derived from source rows and never stored. It is reported as separate
 * signals rather than one blended percentage, so it is clear what each number means:
 * - milestones completed of all milestones;
 * - the optional measurable target (current / target);
 * - work: tasks of linked projects plus tasks linked to the goal directly, each counted once
 *   (cancelled tasks excluded).
 */

export type GoalStatus = "active" | "paused" | "achieved" | "archived";

export const GOAL_STATUSES: { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "achieved", label: "Achieved" },
  { value: "archived", label: "Archived" },
];

export type MilestoneLike = {
  id: string;
  title: string;
  due_date: IsoDate | null;
  completed_at: string | null;
  sort_order: number;
};

export type Measure = { current: number; target: number; unit: string | null; percent: number };

export type GoalProgress = {
  milestones: ProgressSummary;
  measure: Measure | null;
  work: ProgressSummary;
};

export function measureOf(goal: {
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
}): Measure | null {
  if (goal.target_value === null) return null;
  const current = goal.current_value ?? 0;
  return {
    current,
    target: goal.target_value,
    unit: goal.unit,
    percent: Math.min(100, Math.round((current / goal.target_value) * 100)),
  };
}

export function goalProgress(
  goal: { target_value: number | null; current_value: number | null; unit: string | null },
  milestones: readonly MilestoneLike[],
  tasks: readonly { id: string; status: TaskStatus }[],
): GoalProgress {
  const done = milestones.filter((m) => m.completed_at !== null).length;
  const unique = new Map(tasks.map((t) => [t.id, t]));
  return {
    milestones: {
      done,
      total: milestones.length,
      percent: milestones.length ? Math.round((done / milestones.length) * 100) : 0,
    },
    measure: measureOf(goal),
    work: progressOf([...unique.values()]),
  };
}

/** Milestones in the order the user arranged them. */
export function sortMilestones<T extends MilestoneLike>(milestones: readonly T[]): T[] {
  return [...milestones].sort((a, b) => a.sort_order - b.sort_order);
}

/** The next open milestone: earliest due date first, then list order. */
export function nextMilestone<T extends MilestoneLike>(milestones: readonly T[]): T | null {
  const open = milestones.filter((m) => m.completed_at === null);
  open.sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return a.sort_order - b.sort_order;
  });
  return open[0] ?? null;
}

/** A target date that has passed for a goal still being worked on. */
export function isGoalOverdue(
  goal: { target_date: IsoDate | null; status: GoalStatus },
  today: IsoDate,
): boolean {
  return (
    goal.target_date !== null &&
    goal.target_date < today &&
    (goal.status === "active" || goal.status === "paused")
  );
}
