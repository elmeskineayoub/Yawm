/**
 * Pure helpers for the weekly review. The statistics themselves are derived in queries from real
 * rows; this module only shapes aggregates and defines the reflection prompts, so the meaning of
 * each number stays clear (REQUIREMENTS 6.14).
 */

export const REVIEW_FIELDS = ["went_well", "could_improve", "lessons", "next_focus"] as const;
export type ReviewField = (typeof REVIEW_FIELDS)[number];

export const REVIEW_PROMPTS: Record<ReviewField, { label: string; placeholder: string }> = {
  went_well: { label: "What went well?", placeholder: "Wins, progress, things to keep doing…" },
  could_improve: {
    label: "What didn't go well?",
    placeholder: "What got in the way or slipped…",
  },
  lessons: { label: "What did I learn?", placeholder: "Insights to carry forward…" },
  next_focus: {
    label: "Next week's priorities",
    placeholder: "The few outcomes that matter most next week…",
  },
};

export type HabitRate = { done: number; due: number; rate: number | null };

export type WeekHabitSummary = HabitRate & {
  perHabit: ({ id: string; title: string } & HabitRate)[];
};

/** Aggregates per-habit rates into one week figure (due = scheduled occurrences, rest excluded). */
export function aggregateHabitRates(
  perHabit: ({ id: string; title: string } & HabitRate)[],
): WeekHabitSummary {
  const done = perHabit.reduce((sum, h) => sum + h.done, 0);
  const due = perHabit.reduce((sum, h) => sum + h.due, 0);
  return { done, due, rate: due === 0 ? null : done / due, perHabit };
}

/** A rate (0–1) as a whole percentage, or null when nothing was due. */
export function ratePercent(rate: number | null): number | null {
  return rate === null ? null : Math.round(rate * 100);
}
