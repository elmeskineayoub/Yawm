import "server-only";
import { GOAL_STATUSES } from "@/features/goals/logic";
import { IDEA_STATUS_LABELS } from "@/features/inbox/schemas";
import { PROJECT_STATUS_LABELS } from "@/features/projects/schemas";
import { STATUS_LABELS } from "@/features/tasks/logic";
import { formatDate, type IsoDate } from "@/lib/dates";
import { ilikeAny } from "@/lib/search";
import type { WorkspaceContext } from "@/lib/workspace-context";
import {
  excerpt,
  RESULTS_PER_TYPE,
  type SearchResponse,
  type SearchResult,
  type SearchType,
} from "./logic";

const goalLabel = (status: string) =>
  GOAL_STATUSES.find((s) => s.value === status)?.label ?? status;

/**
 * Searches titles and text of tasks, projects, goals, ideas, notes, and journal entries in the
 * caller's workspace. Every query is scoped to the workspace explicitly and by RLS. One row more
 * than shown is fetched per type so the UI can offer "See all". Query text is never logged.
 */
export async function searchWorkspace(
  { supabase, workspace }: WorkspaceContext,
  query: string,
): Promise<SearchResponse> {
  const limit = RESULTS_PER_TYPE + 1;
  const ws = workspace.id;

  const [tasks, projects, goals, ideas, notes, journal] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, description, status, due_date")
      .eq("workspace_id", ws)
      .or(ilikeAny(["title", "description"], query))
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("projects")
      .select("id, name, description, notes, status")
      .eq("workspace_id", ws)
      .or(ilikeAny(["name", "description", "notes"], query))
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("goals")
      .select("id, title, description, why, status")
      .eq("workspace_id", ws)
      .or(ilikeAny(["title", "description", "why"], query))
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("ideas")
      .select("id, title, body, status")
      .eq("workspace_id", ws)
      .or(ilikeAny(["title", "body"], query))
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notes")
      .select("id, title, body, archived_at")
      .eq("workspace_id", ws)
      .or(ilikeAny(["title", "body"], query))
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("journal_entries")
      .select("id, title, body, entry_date")
      .eq("workspace_id", ws)
      .or(ilikeAny(["title", "body"], query))
      .order("entry_date", { ascending: false })
      .limit(limit),
  ]);
  for (const result of [tasks, projects, goals, ideas, notes, journal]) {
    if (result.error) throw new Error("Search failed.");
  }

  // Show a snippet only when the title itself didn't match (the match is in the text).
  const snippetFor = (title: string, ...texts: (string | null)[]) => {
    if (title.toLowerCase().includes(query.toLowerCase())) return null;
    for (const text of texts) {
      const found = excerpt(text, query);
      if (found) return found;
    }
    return null;
  };

  const groups: { type: SearchType; rows: SearchResult[] }[] = [
    {
      type: "task",
      rows: (tasks.data ?? []).map((t) => ({
        type: "task",
        id: t.id,
        title: t.title,
        href: `/tasks/${t.id}`,
        snippet: snippetFor(t.title, t.description),
        meta: [
          STATUS_LABELS[t.status],
          t.due_date ? `Due ${formatDate(t.due_date as IsoDate, "short")}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    },
    {
      type: "project",
      rows: (projects.data ?? []).map((p) => ({
        type: "project",
        id: p.id,
        title: p.name,
        href: `/projects/${p.id}`,
        snippet: snippetFor(p.name, p.description, p.notes),
        meta: PROJECT_STATUS_LABELS[p.status],
      })),
    },
    {
      type: "goal",
      rows: (goals.data ?? []).map((g) => ({
        type: "goal",
        id: g.id,
        title: g.title,
        href: `/goals/${g.id}`,
        snippet: snippetFor(g.title, g.description, g.why),
        meta: goalLabel(g.status),
      })),
    },
    {
      type: "idea",
      rows: (ideas.data ?? []).map((i) => ({
        type: "idea",
        id: i.id,
        title: i.title,
        href: `/inbox/${i.id}`,
        snippet: snippetFor(i.title, i.body),
        meta: IDEA_STATUS_LABELS[i.status],
      })),
    },
    {
      type: "note",
      rows: (notes.data ?? []).map((n) => ({
        type: "note",
        id: n.id,
        title: n.title,
        href: `/notes/${n.id}`,
        snippet: snippetFor(n.title, n.body),
        meta: n.archived_at ? "Archived" : null,
      })),
    },
    {
      type: "journal",
      rows: (journal.data ?? []).map((j) => {
        const date = formatDate(j.entry_date as IsoDate, "short");
        const title = j.title?.trim() || date;
        return {
          type: "journal",
          id: j.id,
          title,
          href: `/journal/${j.id}`,
          snippet: snippetFor(title, j.body),
          meta: j.title?.trim() ? date : null,
        };
      }),
    },
  ];

  return {
    query,
    groups: groups
      .filter((g) => g.rows.length > 0)
      .map((g) => ({
        type: g.type,
        results: g.rows.slice(0, RESULTS_PER_TYPE),
        more: g.rows.length > RESULTS_PER_TYPE,
      })),
  };
}
