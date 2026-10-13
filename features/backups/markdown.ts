import { energyLabel, moodLabel } from "@/features/journal/logic";
import { formatDate } from "@/lib/dates";
import type { Database } from "@/types/database";

type JournalRow = Database["public"]["Tables"]["journal_entries"]["Row"];

export type JournalMdInput = {
  journal_entries: readonly Pick<
    JournalRow,
    "id" | "entry_date" | "title" | "body" | "mood" | "energy" | "created_at"
  >[];
  journal_entry_tags: readonly { entry_id: string; tag_id: string }[];
  tags: readonly { id: string; name: string }[];
};

/** Journal entries as Markdown (REQUIREMENTS 8.6), newest first, with mood/energy/tags and body. */
export function journalToMarkdown(records: JournalMdInput): string {
  const tagName = new Map(records.tags.map((t) => [t.id, t.name]));
  const tagsByEntry = new Map<string, string[]>();
  for (const { entry_id, tag_id } of records.journal_entry_tags) {
    const name = tagName.get(tag_id);
    if (name) tagsByEntry.set(entry_id, [...(tagsByEntry.get(entry_id) ?? []), name]);
  }

  const entries = [...records.journal_entries].sort((a, b) =>
    a.entry_date === b.entry_date
      ? b.created_at.localeCompare(a.created_at)
      : b.entry_date.localeCompare(a.entry_date),
  );

  const blocks = entries.map((entry) => {
    const heading = entry.title?.trim()
      ? `## ${formatDate(entry.entry_date)} — ${entry.title.trim()}`
      : `## ${formatDate(entry.entry_date)}`;

    const meta: string[] = [];
    const mood = moodLabel(entry.mood);
    const energy = energyLabel(entry.energy);
    if (mood) meta.push(`Mood: ${mood}`);
    if (energy) meta.push(`Energy: ${energy}`);
    const tags = tagsByEntry.get(entry.id) ?? [];
    if (tags.length) meta.push(tags.map((t) => `#${t}`).join(" "));

    return [heading, meta.length ? `_${meta.join(" · ")}_` : null, entry.body?.trim() || null]
      .filter((line): line is string => line !== null)
      .join("\n\n");
  });

  return ["# Journal", ...blocks].join("\n\n") + "\n";
}
