import type { IsoDate } from "@/lib/dates";

/**
 * Journal reflection logic, kept pure so it is easy to test. Journal text is private and is never
 * sent to any AI, analytics, or third-party service (REQUIREMENTS 6.11).
 */

/** The default daily reflection prompts (REQUIREMENTS 6.11). Configurable by the user later. */
export const JOURNAL_PROMPTS = [
  "What mattered today?",
  "What went well?",
  "What did I learn?",
  "What should change tomorrow?",
  "What am I grateful for?",
] as const;

/** A starting scaffold for a reflective entry: each prompt as a heading with space to write under. */
export function buildJournalTemplate(prompts: readonly string[] = JOURNAL_PROMPTS): string {
  return (
    prompts
      .map((prompt) => `${prompt}\n\n`)
      .join("\n")
      .trimEnd() + "\n"
  );
}

export const MOOD_LABELS = ["Very low", "Low", "Okay", "Good", "Great"] as const;
export const ENERGY_LABELS = ["Drained", "Low", "Moderate", "High", "Energized"] as const;

/** 1–5 → label, or null when not recorded. */
export function moodLabel(value: number | null): string | null {
  return value && value >= 1 && value <= 5 ? MOOD_LABELS[value - 1]! : null;
}

export function energyLabel(value: number | null): string | null {
  return value && value >= 1 && value <= 5 ? ENERGY_LABELS[value - 1]! : null;
}

export type DatedEntry = { entry_date: IsoDate };

export type MonthGroup<T extends DatedEntry> = {
  /** `YYYY-MM`. */
  month: string;
  entries: T[];
};

/**
 * Groups entries by calendar month, newest month first, preserving the given order within a month.
 * Entries are assumed to arrive already sorted (most recent first).
 */
export function groupByMonth<T extends DatedEntry>(entries: readonly T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  const index = new Map<string, MonthGroup<T>>();
  for (const entry of entries) {
    const month = entry.entry_date.slice(0, 7);
    let group = index.get(month);
    if (!group) {
      group = { month, entries: [] };
      index.set(month, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

/** A short preview of an entry's body for list rows. */
export function entryPreview(body: string | null, max = 140): string {
  if (!body) return "";
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
