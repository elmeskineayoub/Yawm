import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  publicClient,
  seedWorkspace,
  type TestUser,
  type WorkspaceFixture,
} from "./helpers";

const INSUFFICIENT_PRIVILEGE = "42501";
const FOREIGN_KEY_VIOLATION = "23503";

let alice: TestUser;
let bob: TestUser;
let a: WorkspaceFixture;
let b: WorkspaceFixture;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-core");
  bob = await createConfirmedUser("bob-core");
  [a, b] = await Promise.all([seedWorkspace(alice), seedWorkspace(bob)]);
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

// Tables with a single `id` primary key, and how to address Bob's row in each.
const keyedTables = [
  { table: "tags", id: () => b.tagId, update: { name: "hacked" } },
  { table: "projects", id: () => b.projectId, update: { name: "hacked" } },
  { table: "tasks", id: () => b.taskId, update: { title: "hacked" } },
  { table: "ideas", id: () => b.ideaId, update: { title: "hacked" } },
  { table: "plans", id: () => b.dayPlanId, update: { theme: "hacked" } },
  { table: "plan_items", id: () => b.planItemId, update: { sort_order: 99 } },
] as const;

describe("another workspace's rows", () => {
  it.each(keyedTables)("$table: cannot be read", async ({ table, id }) => {
    const { data, error } = await alice.client.from(table).select("id").eq("id", id());
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(keyedTables)("$table: cannot be updated", async ({ table, id, update }) => {
    const { data, error } = await alice.client
      .from(table)
      .update(update as never)
      .eq("id", id())
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(keyedTables)("$table: cannot be deleted", async ({ table, id }) => {
    const { data, error } = await alice.client.from(table).delete().eq("id", id()).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const stillThere = await adminClient().from(table).select("id").eq("id", id());
    expect(stillThere.data).toHaveLength(1);
  });

  it("link tables cannot be read or deleted", async () => {
    for (const [table, column, value] of [
      ["task_tags", "task_id", b.taskId],
      ["task_dependencies", "task_id", b.taskId],
      ["idea_tags", "idea_id", b.ideaId],
    ] as const) {
      const read = await alice.client.from(table).select("*").filter(column, "eq", value);
      expect(read).toMatchObject({ error: null, data: [] });
      const remove = await alice.client.from(table).delete().filter(column, "eq", value).select();
      expect(remove).toMatchObject({ error: null, data: [] });
      const stillThere = await adminClient().from(table).select("*").filter(column, "eq", value);
      expect(stillThere.data).toHaveLength(1);
    }
  });

  it("unfiltered queries return only the caller's workspace", async () => {
    for (const table of [
      "tags",
      "projects",
      "tasks",
      "ideas",
      "plans",
      "plan_items",
      "task_tags",
      "task_dependencies",
      "idea_tags",
    ] as const) {
      const { data, error } = await alice.client.from(table).select("workspace_id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((row) => row.workspace_id === a.workspaceId)).toBe(true);
    }
  });

  it("anonymous callers get nothing", async () => {
    const anon = publicClient();
    for (const table of ["tags", "projects", "tasks", "ideas", "plans", "plan_items"] as const) {
      const { data, error } = await anon.from(table).select("id");
      expect(error?.code === INSUFFICIENT_PRIVILEGE || data?.length === 0).toBe(true);
    }
  });
});

describe("inserting into another workspace", () => {
  it.each([
    ["tags", () => ({ workspace_id: b.workspaceId, name: "x" })],
    ["projects", () => ({ workspace_id: b.workspaceId, name: "x" })],
    ["tasks", () => ({ workspace_id: b.workspaceId, title: "x" })],
    ["ideas", () => ({ workspace_id: b.workspaceId, title: "x" })],
    ["plans", () => ({ workspace_id: b.workspaceId, period: "day", period_start: "2026-10-20" })],
    [
      "plan_items",
      () => ({ workspace_id: b.workspaceId, plan_id: b.dayPlanId, task_id: b.blockerId }),
    ],
    ["task_tags", () => ({ workspace_id: b.workspaceId, task_id: b.blockerId, tag_id: b.tagId })],
    [
      "task_dependencies",
      () => ({
        workspace_id: b.workspaceId,
        task_id: b.blockerId,
        depends_on_task_id: b.subtaskId,
      }),
    ],
    ["idea_tags", () => ({ workspace_id: b.workspaceId, idea_id: b.ideaId, tag_id: b.tagId })],
  ] as const)("%s is rejected by RLS", async (table, row) => {
    const { error } = await alice.client.from(table).insert(row() as never);
    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe("linking own rows to another workspace's rows", () => {
  // RLS passes (the row is in Alice's workspace) but the composite foreign keys do not.
  it.each([
    ["task → other project", "tasks", () => ({ title: "x", project_id: b.projectId })],
    ["task → other area", "tasks", () => ({ title: "x", area_id: b.areaId })],
    ["subtask → other parent", "tasks", () => ({ title: "x", parent_task_id: b.taskId })],
    ["project → other area", "projects", () => ({ name: "x", area_id: b.areaId })],
    [
      "plan → other parent",
      "plans",
      () => ({ period: "month", period_start: "2026-11-01", parent_plan_id: b.yearPlanId }),
    ],
    ["plan item → other task", "plan_items", () => ({ plan_id: a.dayPlanId, task_id: b.taskId })],
    [
      "plan item → other plan",
      "plan_items",
      () => ({ plan_id: b.dayPlanId, task_id: a.blockerId }),
    ],
    ["task tag → other tag", "task_tags", () => ({ task_id: a.blockerId, tag_id: b.tagId })],
    [
      "dependency → other task",
      "task_dependencies",
      () => ({ task_id: a.blockerId, depends_on_task_id: b.taskId }),
    ],
    ["idea tag → other tag", "idea_tags", () => ({ idea_id: a.ideaId, tag_id: b.tagId })],
  ] as const)("%s is rejected", async (_label, table, row) => {
    const { error } = await alice.client
      .from(table)
      .insert({ workspace_id: a.workspaceId, ...row() } as never);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("an existing task cannot be re-pointed at another workspace's project", async () => {
    const { error } = await alice.client
      .from("tasks")
      .update({ project_id: b.projectId })
      .eq("id", a.taskId);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("rows cannot be moved to another workspace", async () => {
    const { error } = await alice.client
      .from("tasks")
      .update({ workspace_id: b.workspaceId } as never)
      .eq("id", a.taskId);
    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("tag assignment cannot target another workspace's task or idea", async () => {
    const task = await alice.client.rpc("set_task_tags", {
      target_task_id: b.taskId,
      tag_names: ["x"],
    });
    expect(task.error?.code).toBe("P0002");
    const idea = await alice.client.rpc("set_idea_tags", {
      target_idea_id: b.ideaId,
      tag_names: [],
    });
    expect(idea.error?.code).toBe("P0002");
    const { data } = await adminClient().from("idea_tags").select("tag_id").eq("idea_id", b.ideaId);
    expect(data).toHaveLength(1);
  });

  it("idea conversion cannot target another workspace's idea", async () => {
    const { error } = await alice.client.rpc("convert_idea_to_task", { idea_id: b.ideaId });
    expect(error?.code).toBe("P0002");
    const { data } = await adminClient()
      .from("ideas")
      .select("converted_task_id")
      .eq("id", b.ideaId)
      .single();
    expect(data?.converted_task_id).toBeNull();
  });
});

describe("viewer role", () => {
  let viewer: TestUser;

  beforeAll(async () => {
    viewer = await createConfirmedUser("viewer-core");
    const { error } = await adminClient()
      .from("workspace_members")
      .insert({ workspace_id: a.workspaceId, user_id: viewer.id, role: "viewer" });
    if (error) throw error;
  });

  afterAll(async () => {
    await deleteUsers(viewer);
  });

  it("can read but not write", async () => {
    const read = await viewer.client.from("tasks").select("id").eq("workspace_id", a.workspaceId);
    expect(read.data!.length).toBeGreaterThan(0);

    const insert = await viewer.client
      .from("tasks")
      .insert({ workspace_id: a.workspaceId, title: "x" });
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);

    const update = await viewer.client
      .from("tasks")
      .update({ title: "x" })
      .eq("id", a.taskId)
      .select();
    expect(update).toMatchObject({ error: null, data: [] });

    const remove = await viewer.client.from("ideas").delete().eq("id", a.ideaId).select();
    expect(remove).toMatchObject({ error: null, data: [] });

    const convert = await viewer.client.rpc("convert_idea_to_task", { idea_id: a.ideaId });
    expect(convert.error).not.toBeNull();
  });
});
