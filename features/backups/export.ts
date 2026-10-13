import type { Db } from "@/lib/db/types";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Database } from "@/types/database";

/**
 * Full-workspace export (REQUIREMENTS 8.4). Gathers every content and settings table the caller can
 * read (RLS still applies) into one versioned JSON bundle. Secrets are never exported: Google
 * connection tokens (`google_calendar_connections`, `time_block_sync`) and transient reminder
 * dismissals are deliberately excluded. Vision-board images are referenced by their storage path;
 * the binary files are not inlined in the JSON.
 */

export const EXPORT_SCHEMA_VERSION = 1;

type Tables = Database["public"]["Tables"];

/** Tables included in a backup, each with a stable order for correct paging. */
const EXPORT_TABLES = {
  areas: ["id"],
  tags: ["id"],
  projects: ["id"],
  tasks: ["id"],
  task_tags: ["task_id", "tag_id"],
  task_dependencies: ["task_id", "depends_on_task_id"],
  ideas: ["id"],
  idea_tags: ["idea_id", "tag_id"],
  plans: ["id"],
  plan_items: ["id"],
  goals: ["id"],
  milestones: ["id"],
  habits: ["id"],
  habit_logs: ["id"],
  vision_board_items: ["id"],
  time_blocks: ["id"],
  notes: ["id"],
  note_tags: ["note_id", "tag_id"],
  journal_entries: ["id"],
  journal_entry_tags: ["entry_id", "tag_id"],
  focus_sessions: ["id"],
  weekly_reviews: ["id"],
  reminder_preferences: ["workspace_id"],
} as const satisfies Partial<Record<keyof Tables, readonly string[]>>;

type ExportTable = keyof typeof EXPORT_TABLES;

export type ExportRecords = { [K in ExportTable]: Tables[K]["Row"][] };

export type ExportBundle = {
  app: "Yawm";
  schema_version: number;
  exported_at: string;
  workspace: { id: string; name: string };
  profile: Pick<Tables["profiles"]["Row"], "display_name" | "timezone" | "week_start"> | null;
  records: ExportRecords;
};

const PAGE = 1000;

// Dynamic table access over 23 tables defeats the client's per-table result inference, so the query
// is driven through a minimal structural type and the rows are cast back to the known row type.
type Pager = {
  eq: (column: string, value: string) => Pager;
  order: (column: string) => Pager;
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

/** Reads every row of one table for a workspace, paging past PostgREST's row cap in a stable order. */
async function selectAll<K extends ExportTable>(
  db: Db,
  workspaceId: string,
  table: K,
  order: readonly string[],
): Promise<Tables[K]["Row"][]> {
  const rows: Tables[K]["Row"][] = [];
  for (let page = 0; page < 5000; page++) {
    let builder = (db.from(table).select("*") as unknown as Pager).eq("workspace_id", workspaceId);
    for (const column of order) builder = builder.order(column);
    const { data, error } = await builder.range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data) throw new Error(`Could not export ${table}.`);
    rows.push(...(data as Tables[K]["Row"][]));
    if (data.length < PAGE) break;
  }
  return rows;
}

export async function buildExportBundle(ctx: WorkspaceContext): Promise<ExportBundle> {
  const { supabase, workspace, user } = ctx;

  const [profile, ...tableResults] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, timezone, week_start")
      .eq("id", user.id)
      .maybeSingle(),
    ...(Object.keys(EXPORT_TABLES) as ExportTable[]).map((table) =>
      selectAll(supabase, workspace.id, table, EXPORT_TABLES[table]),
    ),
  ]);

  const records = Object.fromEntries(
    (Object.keys(EXPORT_TABLES) as ExportTable[]).map((table, i) => [table, tableResults[i]]),
  ) as ExportRecords;

  return {
    app: "Yawm",
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    workspace: { id: workspace.id, name: workspace.name },
    profile: profile.data ?? null,
    records,
  };
}
