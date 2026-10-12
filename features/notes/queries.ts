import { ilikeAny } from "@/lib/search";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";

export type NoteRow = Pick<
  Database["public"]["Tables"]["notes"]["Row"],
  | "id"
  | "title"
  | "body"
  | "project_id"
  | "goal_id"
  | "task_id"
  | "archived_at"
  | "created_at"
  | "updated_at"
>;
export type NoteView = NoteRow & { tags: { id: string; name: string }[] };

export type NoteFilters = { q: string | null; tagId: string | null; archived: boolean };

export type NotePage = {
  notes: NoteView[];
  /** Number of notes matching every filter. */
  total: number;
  /** 1-based; clamped to the last page when the requested page is past the end. */
  page: number;
  pageCount: number;
  pageSize: number;
};

export const NOTE_PAGE_SIZE = 50;

const NOTE_COLUMNS =
  "id, title, body, project_id, goal_id, task_id, archived_at, created_at, updated_at" as const;

async function queryPage(
  { supabase, workspace }: WorkspaceContext,
  filters: NoteFilters,
  page: number,
  pageSize: number,
) {
  // `tag_match` is a left-joined embed; filtering it to non-null makes it an inner join, so the
  // tag filter runs in the database before paging (same technique as the inbox).
  let query = supabase
    .from("notes")
    .select(`${NOTE_COLUMNS}, tag_match:note_tags(tag_id)`, { count: "exact" })
    .eq("workspace_id", workspace.id);
  query = filters.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (filters.q) query = query.or(ilikeAny(["title", "body"], filters.q));
  if (filters.tagId) {
    query = query.eq("tag_match.tag_id", filters.tagId).not("tag_match", "is", null);
  }
  const from = (page - 1) * pageSize;
  return query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
}

/** One page of notes, most recently updated first, with every filter applied before paging. */
export async function loadNotes(
  ctx: WorkspaceContext,
  filters: NoteFilters,
  { page = 1, pageSize = NOTE_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<NotePage> {
  let current = Math.max(1, Math.floor(page));
  let result = await queryPage(ctx, filters, current, pageSize);
  // A page past the end is answered with "range not satisfiable" (PGRST103) and no count:
  // read the total from page 1, then show the last page instead.
  if (result.error?.code === "PGRST103" && current > 1) {
    const first = await queryPage(ctx, filters, 1, pageSize);
    const lastPage = Math.max(1, Math.ceil((first.count ?? 0) / pageSize));
    current = lastPage;
    result = lastPage === 1 ? first : await queryPage(ctx, filters, lastPage, pageSize);
  }
  if (result.error) throw new Error("Could not load notes.");
  const total = result.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const rows: NoteRow[] = result.data.map(({ tag_match, ...row }) => {
    void tag_match;
    return row;
  });

  const ids = rows.map((r) => r.id);
  const noteTags = ids.length
    ? await ctx.supabase.from("note_tags").select("note_id, tags(id, name)").in("note_id", ids)
    : { data: [], error: null };
  if (noteTags.error) throw new Error("Could not load note tags.");
  const tagsByNote = new Map<string, { id: string; name: string }[]>();
  for (const { note_id, tags } of noteTags.data) {
    if (tags) tagsByNote.set(note_id, [...(tagsByNote.get(note_id) ?? []), tags]);
  }

  return {
    notes: rows.map((note) => ({
      ...note,
      tags: (tagsByNote.get(note.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    })),
    total,
    page: current,
    pageCount,
    pageSize,
  };
}

export type NoteDetail = NoteRow & {
  tags: string[];
  project: { id: string; name: string } | null;
  goal: { id: string; title: string } | null;
  task: { id: string; title: string } | null;
};

/** One note with its tag names and the titles of anything it links to. */
export async function loadNote(ctx: WorkspaceContext, noteId: string): Promise<NoteDetail | null> {
  const { supabase, workspace } = ctx;
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("workspace_id", workspace.id)
    .eq("id", noteId)
    .maybeSingle();
  if (error) throw new Error("Could not load the note.");
  if (!data) return null;

  const [tags, project, goal, task] = await Promise.all([
    supabase.from("note_tags").select("tags(name)").eq("note_id", noteId),
    data.project_id
      ? supabase.from("projects").select("id, name").eq("id", data.project_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.goal_id
      ? supabase.from("goals").select("id, title").eq("id", data.goal_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.task_id
      ? supabase.from("tasks").select("id, title").eq("id", data.task_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (tags.error) throw new Error("Could not load note tags.");

  return {
    ...data,
    tags: (tags.data ?? []).flatMap((row) => (row.tags ? [row.tags.name] : [])),
    project: project.data ?? null,
    goal: goal.data ?? null,
    task: task.data ?? null,
  };
}
