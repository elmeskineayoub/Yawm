import { ilikeAny } from "@/lib/search";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";
import type { IdeaStatus } from "./schemas";

export type IdeaRow = Pick<
  Database["public"]["Tables"]["ideas"]["Row"],
  "id" | "title" | "body" | "status" | "converted_task_id" | "converted_project_id" | "created_at"
>;
export type IdeaView = IdeaRow & { tags: { id: string; name: string }[] };

export type IdeaFilters = { status: IdeaStatus | "all"; q: string | null; tagId: string | null };

export type IdeaPage = {
  ideas: IdeaView[];
  /** Number of ideas matching every filter. */
  total: number;
  /** 1-based; clamped to the last page when the requested page is past the end. */
  page: number;
  pageCount: number;
  pageSize: number;
};

export const IDEA_PAGE_SIZE = 50;

const IDEA_COLUMNS =
  "id, title, body, status, converted_task_id, converted_project_id, created_at" as const;

async function queryPage(
  { supabase, workspace }: WorkspaceContext,
  filters: IdeaFilters,
  page: number,
  pageSize: number,
) {
  // `tag_match` is a left-joined embed; filtering it to non-null makes it an inner join, so the
  // tag filter runs in the database before paging.
  let query = supabase
    .from("ideas")
    .select(`${IDEA_COLUMNS}, tag_match:idea_tags(tag_id)`, { count: "exact" })
    .eq("workspace_id", workspace.id);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.q) query = query.or(ilikeAny(["title", "body"], filters.q));
  if (filters.tagId) {
    query = query.eq("tag_match.tag_id", filters.tagId).not("tag_match", "is", null);
  }
  const from = (page - 1) * pageSize;
  return query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
}

/** One page of ideas, newest first, with every filter applied before paging. */
export async function loadIdeas(
  ctx: WorkspaceContext,
  filters: IdeaFilters,
  { page = 1, pageSize = IDEA_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<IdeaPage> {
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
  if (result.error) throw new Error("Could not load ideas.");
  const total = result.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const rows: IdeaRow[] = result.data.map(({ tag_match, ...row }) => {
    void tag_match;
    return row;
  });

  // Tags for the ideas on this page only.
  const ids = rows.map((r) => r.id);
  const ideaTags = ids.length
    ? await ctx.supabase.from("idea_tags").select("idea_id, tags(id, name)").in("idea_id", ids)
    : { data: [], error: null };
  if (ideaTags.error) throw new Error("Could not load idea tags.");
  const tagsByIdea = new Map<string, { id: string; name: string }[]>();
  for (const { idea_id, tags } of ideaTags.data) {
    if (tags) tagsByIdea.set(idea_id, [...(tagsByIdea.get(idea_id) ?? []), tags]);
  }

  return {
    ideas: rows.map((idea) => ({
      ...idea,
      tags: (tagsByIdea.get(idea.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    })),
    total,
    page: current,
    pageCount,
    pageSize,
  };
}

export async function countInbox({ supabase, workspace }: WorkspaceContext): Promise<number> {
  const { count, error } = await supabase
    .from("ideas")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("status", "inbox");
  if (error) throw new Error("Could not count inbox ideas.");
  return count ?? 0;
}
