import { addMonths } from "@/lib/dates";
import { ilikeAny } from "@/lib/search";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";

export type JournalRow = Pick<
  Database["public"]["Tables"]["journal_entries"]["Row"],
  | "id"
  | "entry_date"
  | "title"
  | "body"
  | "mood"
  | "energy"
  | "prompt"
  | "created_at"
  | "updated_at"
>;
export type JournalView = JournalRow & { tags: { id: string; name: string }[] };

export type JournalFilters = {
  q: string | null;
  tagId: string | null;
  /** `YYYY-MM`, or null for all months. */
  month: string | null;
};

export type JournalPage = {
  entries: JournalView[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export const JOURNAL_PAGE_SIZE = 50;

const JOURNAL_COLUMNS =
  "id, entry_date, title, body, mood, energy, prompt, created_at, updated_at" as const;

async function queryPage(
  { supabase, workspace }: WorkspaceContext,
  filters: JournalFilters,
  page: number,
  pageSize: number,
) {
  let query = supabase
    .from("journal_entries")
    .select(`${JOURNAL_COLUMNS}, tag_match:journal_entry_tags(tag_id)`, { count: "exact" })
    .eq("workspace_id", workspace.id);
  if (filters.month) {
    const start = `${filters.month}-01`;
    query = query.gte("entry_date", start).lt("entry_date", addMonths(start, 1));
  }
  if (filters.q) query = query.or(ilikeAny(["title", "body"], filters.q));
  if (filters.tagId) {
    query = query.eq("tag_match.tag_id", filters.tagId).not("tag_match", "is", null);
  }
  const from = (page - 1) * pageSize;
  return query
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
}

/** One page of entries, newest date first, with every filter applied before paging. */
export async function loadJournalEntries(
  ctx: WorkspaceContext,
  filters: JournalFilters,
  { page = 1, pageSize = JOURNAL_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<JournalPage> {
  let current = Math.max(1, Math.floor(page));
  let result = await queryPage(ctx, filters, current, pageSize);
  if (result.error?.code === "PGRST103" && current > 1) {
    const first = await queryPage(ctx, filters, 1, pageSize);
    const lastPage = Math.max(1, Math.ceil((first.count ?? 0) / pageSize));
    current = lastPage;
    result = lastPage === 1 ? first : await queryPage(ctx, filters, lastPage, pageSize);
  }
  if (result.error) throw new Error("Could not load journal entries.");
  const total = result.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const rows: JournalRow[] = result.data.map(({ tag_match, ...row }) => {
    void tag_match;
    return row;
  });

  const ids = rows.map((r) => r.id);
  const entryTags = ids.length
    ? await ctx.supabase
        .from("journal_entry_tags")
        .select("entry_id, tags(id, name)")
        .in("entry_id", ids)
    : { data: [], error: null };
  if (entryTags.error) throw new Error("Could not load journal tags.");
  const tagsByEntry = new Map<string, { id: string; name: string }[]>();
  for (const { entry_id, tags } of entryTags.data) {
    if (tags) tagsByEntry.set(entry_id, [...(tagsByEntry.get(entry_id) ?? []), tags]);
  }

  return {
    entries: rows.map((entry) => ({
      ...entry,
      tags: (tagsByEntry.get(entry.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    })),
    total,
    page: current,
    pageCount,
    pageSize,
  };
}

export type JournalDetail = JournalRow & { tags: string[] };

export async function loadJournalEntry(
  ctx: WorkspaceContext,
  entryId: string,
): Promise<JournalDetail | null> {
  const { supabase, workspace } = ctx;
  const { data, error } = await supabase
    .from("journal_entries")
    .select(JOURNAL_COLUMNS)
    .eq("workspace_id", workspace.id)
    .eq("id", entryId)
    .maybeSingle();
  if (error) throw new Error("Could not load the journal entry.");
  if (!data) return null;

  const tags = await supabase
    .from("journal_entry_tags")
    .select("tags(name)")
    .eq("entry_id", entryId);
  if (tags.error) throw new Error("Could not load journal tags.");

  return { ...data, tags: (tags.data ?? []).flatMap((row) => (row.tags ? [row.tags.name] : [])) };
}

/** Months that have at least one entry, newest first — for the month picker. */
export async function loadJournalMonths(ctx: WorkspaceContext): Promise<string[]> {
  const { data, error } = await ctx.supabase
    .from("journal_entries")
    .select("entry_date")
    .eq("workspace_id", ctx.workspace.id)
    .order("entry_date", { ascending: false })
    .limit(3000);
  if (error) throw new Error("Could not load journal months.");
  const months = new Set(data.map((row) => row.entry_date.slice(0, 7)));
  return [...months];
}
