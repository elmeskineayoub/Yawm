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
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

let alice: TestUser;
let bob: TestUser;
let a: WorkspaceFixture;
let b: WorkspaceFixture;
let bobBlockId: string;

const at = (iso: string) => new Date(iso).toISOString();

beforeAll(async () => {
  alice = await createConfirmedUser("alice-blocks");
  bob = await createConfirmedUser("bob-blocks");
  [a, b] = await Promise.all([seedWorkspace(alice), seedWorkspace(bob)]);
  const { data, error } = await bob.client
    .from("time_blocks")
    .insert({
      workspace_id: b.workspaceId,
      title: "Deep work",
      starts_at: at("2026-10-14T08:00:00Z"),
      ends_at: at("2026-10-14T10:00:00Z"),
      timezone: "Europe/London",
      task_id: b.taskId,
    })
    .select()
    .single();
  if (error) throw error;
  bobBlockId = data.id;
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

function block(fields: Record<string, unknown> = {}) {
  return {
    workspace_id: a.workspaceId,
    title: "Block",
    starts_at: at("2026-10-14T09:00:00Z"),
    ends_at: at("2026-10-14T10:00:00Z"),
    timezone: "UTC",
    ...fields,
  };
}

describe("time block isolation", () => {
  it("hides another workspace's blocks", async () => {
    const byId = await alice.client.from("time_blocks").select("id").eq("id", bobBlockId);
    expect(byId).toMatchObject({ error: null, data: [] });
    const all = await alice.client.from("time_blocks").select("workspace_id");
    expect(all.data?.every((r) => r.workspace_id === a.workspaceId)).toBe(true);
  });

  it("rejects inserting into another workspace", async () => {
    const { error } = await alice.client
      .from("time_blocks")
      .insert(block({ workspace_id: b.workspaceId }) as never);
    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("cannot move, edit, or delete another workspace's block", async () => {
    const update = await alice.client
      .from("time_blocks")
      .update({ starts_at: at("2026-10-14T07:00:00Z") })
      .eq("id", bobBlockId)
      .select();
    expect(update).toMatchObject({ error: null, data: [] });
    const remove = await alice.client.from("time_blocks").delete().eq("id", bobBlockId).select();
    expect(remove).toMatchObject({ error: null, data: [] });
    const { data } = await adminClient()
      .from("time_blocks")
      .select("starts_at")
      .eq("id", bobBlockId)
      .single();
    expect(new Date(data!.starts_at).toISOString()).toBe(at("2026-10-14T08:00:00Z"));
  });

  it("cannot link a block to another workspace's task or project", async () => {
    const task = await alice.client.from("time_blocks").insert(block({ task_id: b.taskId }));
    expect(task.error?.code).toBe(FOREIGN_KEY_VIOLATION);
    const project = await alice.client
      .from("time_blocks")
      .insert(block({ project_id: b.projectId }));
    expect(project.error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("gives anonymous callers nothing", async () => {
    const { data, error } = await publicClient().from("time_blocks").select("id");
    expect(error?.code === INSUFFICIENT_PRIVILEGE || data?.length === 0).toBe(true);
  });
});

describe("time block rules", () => {
  it("requires the end after the start and at most 24 hours", async () => {
    const backwards = await alice.client
      .from("time_blocks")
      .insert(block({ ends_at: at("2026-10-14T08:59:00Z") }));
    expect(backwards.error?.code).toBe(CHECK_VIOLATION);
    const empty = await alice.client
      .from("time_blocks")
      .insert(block({ ends_at: at("2026-10-14T09:00:00Z") }));
    expect(empty.error?.code).toBe(CHECK_VIOLATION);
    const tooLong = await alice.client
      .from("time_blocks")
      .insert(block({ ends_at: at("2026-10-15T09:01:00Z") }));
    expect(tooLong.error?.code).toBe(CHECK_VIOLATION);
    const fullDay = await alice.client
      .from("time_blocks")
      .insert(block({ ends_at: at("2026-10-15T09:00:00Z") }));
    expect(fullDay.error).toBeNull();
  });

  it("requires a valid IANA timezone", async () => {
    const { error } = await alice.client
      .from("time_blocks")
      .insert(block({ timezone: "Mars/Olympus" }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("stores instants: the same moment entered with different offsets is equal", async () => {
    const { data } = await alice.client
      .from("time_blocks")
      .insert(
        block({
          starts_at: "2026-10-14T18:00:00+09:00",
          ends_at: "2026-10-14T19:30:00+09:00",
          timezone: "Asia/Tokyo",
        }),
      )
      .select()
      .single();
    expect(new Date(data!.starts_at).toISOString()).toBe("2026-10-14T09:00:00.000Z");
    expect(new Date(data!.ends_at).toISOString()).toBe("2026-10-14T10:30:00.000Z");
  });

  it("does not let clients set the origin or external IDs", async () => {
    const origin = await alice.client
      .from("time_blocks")
      .insert(block({ origin: "google", external_event_id: "x" }) as never);
    expect(origin.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("keeps the block when its task is deleted, unlinking it", async () => {
    const { data: task } = await alice.client
      .from("tasks")
      .insert({ workspace_id: a.workspaceId, title: "Temporary" })
      .select()
      .single();
    const { data: created } = await alice.client
      .from("time_blocks")
      .insert(block({ task_id: task!.id }))
      .select()
      .single();
    await alice.client.from("tasks").delete().eq("id", task!.id).throwOnError();
    const { data } = await alice.client
      .from("time_blocks")
      .select("task_id")
      .eq("id", created!.id)
      .single();
    expect(data?.task_id).toBeNull();
  });

  it("does not change the linked task's due date", async () => {
    const { data: task } = await alice.client
      .from("tasks")
      .insert({ workspace_id: a.workspaceId, title: "Deadline", due_date: "2026-10-20" })
      .select()
      .single();
    await alice.client
      .from("time_blocks")
      .insert(block({ task_id: task!.id }))
      .throwOnError();
    const { data } = await alice.client
      .from("tasks")
      .select("due_date")
      .eq("id", task!.id)
      .single();
    expect(data?.due_date).toBe("2026-10-20");
  });
});

describe("externally imported blocks", () => {
  let externalId: string;

  beforeAll(async () => {
    const { data, error } = await adminClient()
      .from("time_blocks")
      .insert({
        ...block(),
        title: "Dentist (Google)",
        origin: "google",
        external_calendar_id: "primary",
        external_event_id: "evt-1",
      })
      .select()
      .single();
    if (error) throw error;
    externalId = data.id;
  });

  it("are visible but read-only to members", async () => {
    const read = await alice.client.from("time_blocks").select("title").eq("id", externalId);
    expect(read.data).toEqual([{ title: "Dentist (Google)" }]);
    const update = await alice.client
      .from("time_blocks")
      .update({ title: "Edited" })
      .eq("id", externalId)
      .select();
    expect(update).toMatchObject({ error: null, data: [] });
    const remove = await alice.client.from("time_blocks").delete().eq("id", externalId).select();
    expect(remove).toMatchObject({ error: null, data: [] });
  });

  it("cannot be imported twice with the same provider event ID", async () => {
    const { error } = await adminClient()
      .from("time_blocks")
      .insert({
        ...block(),
        origin: "google",
        external_calendar_id: "primary",
        external_event_id: "evt-1",
      });
    expect(error?.code).toBe("23505");
  });
});

describe("viewer role", () => {
  let viewer: TestUser;

  beforeAll(async () => {
    viewer = await createConfirmedUser("viewer-blocks");
    await adminClient()
      .from("workspace_members")
      .insert({ workspace_id: a.workspaceId, user_id: viewer.id, role: "viewer" })
      .throwOnError();
  });

  afterAll(async () => {
    await deleteUsers(viewer);
  });

  it("can read blocks but not create them, and cannot add priorities", async () => {
    const read = await viewer.client
      .from("time_blocks")
      .select("id")
      .eq("workspace_id", a.workspaceId);
    expect(read.data!.length).toBeGreaterThan(0);
    const insert = await viewer.client.from("time_blocks").insert(block());
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);

    const before = await adminClient()
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", a.workspaceId);
    const rpc = await viewer.client.rpc("add_task_to_plan", {
      target_plan_id: a.weekPlanId,
      task_title: "Viewer task",
    });
    expect(rpc.error).not.toBeNull();
    const after = await adminClient()
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", a.workspaceId);
    expect(after.count).toBe(before.count);
  });
});

describe("adding priorities", () => {
  it("creates a task and links it to the plan in one step, in order", async () => {
    const first = await alice.client.rpc("add_task_to_plan", {
      target_plan_id: a.weekPlanId,
      task_title: "Write intro",
      task_due_date: "2026-10-16",
    });
    const second = await alice.client.rpc("add_task_to_plan", {
      target_plan_id: a.weekPlanId,
      task_title: "Edit intro",
    });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const { data: items } = await alice.client
      .from("plan_items")
      .select("task_id, sort_order")
      .eq("plan_id", a.weekPlanId)
      .in("task_id", [first.data!, second.data!])
      .order("sort_order");
    expect(items?.map((i) => i.task_id)).toEqual([first.data, second.data]);
    expect(items![1]!.sort_order).toBe(items![0]!.sort_order + 1);

    const { data: task } = await alice.client
      .from("tasks")
      .select("title, due_date, workspace_id")
      .eq("id", first.data!)
      .single();
    expect(task).toEqual({
      title: "Write intro",
      due_date: "2026-10-16",
      workspace_id: a.workspaceId,
    });
  });

  it("creates a project outcome for a plan", async () => {
    const { data, error } = await alice.client.rpc("add_project_to_plan", {
      target_plan_id: a.yearPlanId,
      project_name: "Run a half marathon",
    });
    expect(error).toBeNull();
    const { data: item } = await alice.client
      .from("plan_items")
      .select("plan_id")
      .eq("project_id", data!)
      .single();
    expect(item?.plan_id).toBe(a.yearPlanId);
  });

  it("cannot add to another workspace's plan, and leaves nothing behind", async () => {
    const before = await adminClient()
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", b.workspaceId);
    const task = await alice.client.rpc("add_task_to_plan", {
      target_plan_id: b.weekPlanId,
      task_title: "Intruder",
    });
    expect(task.error?.code).toBe("P0002");
    const project = await alice.client.rpc("add_project_to_plan", {
      target_plan_id: b.weekPlanId,
      project_name: "Intruder",
    });
    expect(project.error?.code).toBe("P0002");
    const after = await adminClient()
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", b.workspaceId);
    expect(after.count).toBe(before.count);
  });

  it("rolls back the task when the title is invalid", async () => {
    const { error } = await alice.client.rpc("add_task_to_plan", {
      target_plan_id: a.weekPlanId,
      task_title: "   ",
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});
