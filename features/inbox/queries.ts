import { ilikeAny } from "@/lib/search";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";
import type { IdeaStatus } from "./schemas";

export type IdeaRow = Pick<
  Database["public"]["Tables"]["ideas"]["Row"],
  "id" | "title" | "body" | "status" | "converted_task_id" | "converted_project_id" | "created_at"
>;
export type IdeaView = IdeaRow & { tags: { id: string; name: string }[] };

export async function loadIdeas(
  { supabase, workspace }: WorkspaceContext,
  filters: { status: IdeaStatus | "all"; q: string | null; tagId: string | null },
): Promise<IdeaView[]> {
  let query = supabase
    .from("ideas")
    .select("id, title, body, status, converted_task_id, converted_project_id, created_at")
    .eq("workspace_id", workspace.id);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.q) query = query.or(ilikeAny(["title", "body"], filters.q));

  const [ideas, ideaTags, tags] = await Promise.all([
    query.order("created_at", { ascending: false }).limit(500),
    supabase.from("idea_tags").select("idea_id, tag_id").eq("workspace_id", workspace.id),
    supabase.from("tags").select("id, name").eq("workspace_id", workspace.id),
  ]);
  if (ideas.error || ideaTags.error || tags.error) throw new Error("Could not load ideas.");

  const tagById = new Map(tags.data.map((t) => [t.id, t]));
  const tagsByIdea = new Map<string, { id: string; name: string }[]>();
  for (const { idea_id, tag_id } of ideaTags.data) {
    const tag = tagById.get(tag_id);
    if (tag) tagsByIdea.set(idea_id, [...(tagsByIdea.get(idea_id) ?? []), tag]);
  }

  const views = ideas.data.map((idea) => ({ ...idea, tags: tagsByIdea.get(idea.id) ?? [] }));
  return filters.tagId ? views.filter((i) => i.tags.some((t) => t.id === filters.tagId)) : views;
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
