import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TypedClient = SupabaseClient<Database>;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; see tests/integration/global-setup.ts`);
  return value;
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

/** Bypasses RLS. Used only to arrange fixtures and to verify state independently. */
export function adminClient(): TypedClient {
  return createClient<Database>(
    env("SUPABASE_TEST_URL"),
    env("SUPABASE_TEST_SECRET_KEY"),
    clientOptions,
  );
}

/** Same credentials a browser has: the publishable key, subject to RLS. */
export function publicClient(): TypedClient {
  return createClient<Database>(
    env("SUPABASE_TEST_URL"),
    env("SUPABASE_TEST_PUBLISHABLE_KEY"),
    clientOptions,
  );
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  client: TypedClient;
};

export async function createConfirmedUser(
  label: string,
  metadata: Record<string, string> = {},
): Promise<TestUser> {
  const email = `${label}-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");

  const client = publicClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;

  return { id: data.user.id, email, password, client };
}

export async function deleteUsers(...users: (TestUser | undefined)[]) {
  const admin = adminClient();
  await Promise.all(
    users.filter((u): u is TestUser => Boolean(u)).map((u) => admin.auth.admin.deleteUser(u.id)),
  );
}

export async function personalWorkspaceId(userId: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();
  if (error) throw error;
  return data.id;
}

export type WorkspaceFixture = {
  workspaceId: string;
  areaId: string;
  tagId: string;
  projectId: string;
  taskId: string;
  subtaskId: string;
  blockerId: string;
  ideaId: string;
  yearPlanId: string;
  monthPlanId: string;
  weekPlanId: string;
  dayPlanId: string;
  planItemId: string;
};

function must<R extends { data: unknown; error: unknown }>(
  result: R,
  what: string,
): NonNullable<R["data"]> {
  if (result.error || result.data === null) {
    throw new Error(`${what} failed: ${JSON.stringify(result.error)}`);
  }
  return result.data as NonNullable<R["data"]>;
}

/** Creates one row in every Phase 2 table using only the user's own (RLS-bound) client. */
export async function seedWorkspace(user: TestUser): Promise<WorkspaceFixture> {
  const db = user.client;
  const workspaceId = await personalWorkspaceId(user.id);
  const area = must(
    await db.from("areas").select("id").eq("name", "Mental").single(),
    "select area",
  );
  const tag = must(
    await db.from("tags").insert({ workspace_id: workspaceId, name: "focus" }).select().single(),
    "insert tag",
  );
  const project = must(
    await db
      .from("projects")
      .insert({ workspace_id: workspaceId, name: "Launch", area_id: area.id })
      .select()
      .single(),
    "insert project",
  );
  const task = must(
    await db
      .from("tasks")
      .insert({ workspace_id: workspaceId, title: "Write plan", project_id: project.id })
      .select()
      .single(),
    "insert task",
  );
  const subtask = must(
    await db
      .from("tasks")
      .insert({ workspace_id: workspaceId, title: "Outline", parent_task_id: task.id })
      .select()
      .single(),
    "insert subtask",
  );
  const blocker = must(
    await db
      .from("tasks")
      .insert({ workspace_id: workspaceId, title: "Research" })
      .select()
      .single(),
    "insert blocker",
  );
  must(
    await db
      .from("task_dependencies")
      .insert({ workspace_id: workspaceId, task_id: task.id, depends_on_task_id: blocker.id })
      .select()
      .single(),
    "insert dependency",
  );
  must(
    await db
      .from("task_tags")
      .insert({ workspace_id: workspaceId, task_id: task.id, tag_id: tag.id })
      .select()
      .single(),
    "insert task tag",
  );
  const idea = must(
    await db
      .from("ideas")
      .insert({ workspace_id: workspaceId, title: "Podcast?", body: "Maybe weekly" })
      .select()
      .single(),
    "insert idea",
  );
  must(
    await db
      .from("idea_tags")
      .insert({ workspace_id: workspaceId, idea_id: idea.id, tag_id: tag.id })
      .select()
      .single(),
    "insert idea tag",
  );
  const insertPlan = async (
    period: "year" | "month" | "week" | "day",
    period_start: string,
    parent_plan_id: string | null,
  ) =>
    must(
      await db
        .from("plans")
        .insert({ workspace_id: workspaceId, period, period_start, parent_plan_id })
        .select()
        .single(),
      `insert ${period} plan`,
    );
  const year = await insertPlan("year", "2026-01-01", null);
  const month = await insertPlan("month", "2026-10-01", year.id);
  const week = await insertPlan("week", "2026-10-12", month.id);
  const day = await insertPlan("day", "2026-10-14", week.id);
  const planItem = must(
    await db
      .from("plan_items")
      .insert({ workspace_id: workspaceId, plan_id: day.id, task_id: task.id })
      .select()
      .single(),
    "insert plan item",
  );

  return {
    workspaceId,
    areaId: area.id,
    tagId: tag.id,
    projectId: project.id,
    taskId: task.id,
    subtaskId: subtask.id,
    blockerId: blocker.id,
    ideaId: idea.id,
    yearPlanId: year.id,
    monthPlanId: month.id,
    weekPlanId: week.id,
    dayPlanId: day.id,
    planItemId: planItem.id,
  };
}
