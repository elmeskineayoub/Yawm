import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  publicClient,
  seedWorkspace,
  type TestUser,
  type TypedClient,
  type WorkspaceFixture,
} from "./helpers";

const INSUFFICIENT_PRIVILEGE = "42501";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

type Phase4 = {
  habitId: string;
  logId: string;
  goalId: string;
  milestoneId: string;
  cardId: string;
};

let alice: TestUser;
let bob: TestUser;
let a: WorkspaceFixture & Phase4;
let b: WorkspaceFixture & Phase4;

/** Awaits an insert that selected `id`, failing loudly if it didn't succeed. */
async function one(
  promise: PromiseLike<{ data: { id: string } | null; error: unknown }>,
): Promise<{ id: string }> {
  const { data, error } = await promise;
  if (error || !data) throw new Error(JSON.stringify(error));
  return data;
}

/** Creates one row in every Phase 4 table with the user's own (RLS-bound) client. */
async function seedPhase4(user: TestUser): Promise<WorkspaceFixture & Phase4> {
  const base = await seedWorkspace(user);
  const db = user.client;
  const ws = base.workspaceId;
  const habit = await one(
    db
      .from("habits")
      .insert({ workspace_id: ws, title: "Read", starts_on: "2026-10-01", area_id: base.areaId })
      .select("id")
      .single(),
  );
  const log = await one(
    db
      .from("habit_logs")
      .insert({ workspace_id: ws, habit_id: habit.id, log_date: "2026-10-12", value: 1 })
      .select("id")
      .single(),
  );
  const goal = await one(
    db.from("goals").insert({ workspace_id: ws, title: "Get fit" }).select("id").single(),
  );
  const milestone = await one(
    db
      .from("milestones")
      .insert({ workspace_id: ws, goal_id: goal.id, title: "Run 5k" })
      .select("id")
      .single(),
  );
  const card = await one(
    db
      .from("vision_board_items")
      .insert({ workspace_id: ws, title: "Mountains", goal_id: goal.id })
      .select("id")
      .single(),
  );
  return {
    ...base,
    habitId: habit.id,
    logId: log.id,
    goalId: goal.id,
    milestoneId: milestone.id,
    cardId: card.id,
  };
}

beforeAll(async () => {
  alice = await createConfirmedUser("alice-p4");
  bob = await createConfirmedUser("bob-p4");
  [a, b] = await Promise.all([seedPhase4(alice), seedPhase4(bob)]);
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

const tables = [
  { table: "habits", id: () => b.habitId, update: { title: "hacked" } },
  { table: "habit_logs", id: () => b.logId, update: { value: 9 } },
  { table: "goals", id: () => b.goalId, update: { title: "hacked" } },
  { table: "milestones", id: () => b.milestoneId, update: { title: "hacked" } },
  { table: "vision_board_items", id: () => b.cardId, update: { title: "hacked" } },
] as const;

describe("another workspace's Phase 4 rows", () => {
  it.each(tables)("$table: cannot be read, updated, or deleted", async ({ table, id, update }) => {
    const read = await alice.client.from(table).select("id").eq("id", id());
    expect(read).toMatchObject({ error: null, data: [] });
    const updated = await alice.client
      .from(table)
      .update(update as never)
      .eq("id", id())
      .select("id");
    expect(updated).toMatchObject({ error: null, data: [] });
    const deleted = await alice.client.from(table).delete().eq("id", id()).select("id");
    expect(deleted).toMatchObject({ error: null, data: [] });
    const still = await adminClient().from(table).select("id").eq("id", id());
    expect(still.data).toHaveLength(1);
  });

  it("unfiltered queries return only the caller's workspace", async () => {
    for (const { table } of tables) {
      const { data, error } = await alice.client.from(table).select("workspace_id");
      expect(error).toBeNull();
      expect(data!.length, table).toBeGreaterThan(0);
      expect(
        data!.every((row) => row.workspace_id === a.workspaceId),
        table,
      ).toBe(true);
    }
  });

  it("anonymous callers get nothing", async () => {
    const anon = publicClient();
    for (const { table } of tables) {
      const { data, error } = await anon.from(table).select("id");
      expect(error?.code === INSUFFICIENT_PRIVILEGE || data?.length === 0, table).toBe(true);
    }
  });

  it.each([
    ["habits", () => ({ workspace_id: b.workspaceId, title: "x", starts_on: "2026-10-01" })],
    [
      "habit_logs",
      () => ({
        workspace_id: b.workspaceId,
        habit_id: b.habitId,
        log_date: "2026-10-13",
        value: 1,
      }),
    ],
    ["goals", () => ({ workspace_id: b.workspaceId, title: "x" })],
    ["milestones", () => ({ workspace_id: b.workspaceId, goal_id: b.goalId, title: "x" })],
    ["vision_board_items", () => ({ workspace_id: b.workspaceId, title: "x" })],
  ] as const)("inserting into another workspace's %s is rejected", async (table, row) => {
    const { error } = await alice.client.from(table).insert(row() as never);
    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("rows cannot be moved to another workspace", async () => {
    for (const { table } of tables) {
      const { error } = await alice.client
        .from(table)
        .update({ workspace_id: b.workspaceId } as never)
        .eq("workspace_id", a.workspaceId);
      expect(error?.code, table).toBe(INSUFFICIENT_PRIVILEGE);
    }
  });
});

describe("links never cross workspaces", () => {
  it.each([
    [
      "habit → other area",
      "habits",
      () => ({ title: "x", starts_on: "2026-10-01", area_id: b.areaId }),
    ],
    [
      "log → other habit",
      "habit_logs",
      () => ({ habit_id: b.habitId, log_date: "2026-10-14", value: 1 }),
    ],
    ["goal → other area", "goals", () => ({ title: "x", area_id: b.areaId })],
    ["milestone → other goal", "milestones", () => ({ goal_id: b.goalId, title: "x" })],
    ["card → other goal", "vision_board_items", () => ({ title: "x", goal_id: b.goalId })],
    ["card → other area", "vision_board_items", () => ({ title: "x", area_id: b.areaId })],
    ["project → other goal", "projects", () => ({ name: "x", goal_id: b.goalId })],
    ["task → other goal", "tasks", () => ({ title: "x", goal_id: b.goalId })],
    ["plan item → other goal", "plan_items", () => ({ plan_id: a.yearPlanId, goal_id: b.goalId })],
    [
      "plan item → other milestone",
      "plan_items",
      () => ({ plan_id: a.monthPlanId, milestone_id: b.milestoneId }),
    ],
  ] as const)("%s is rejected", async (_label, table, row) => {
    const { error } = await alice.client
      .from(table)
      .insert({ workspace_id: a.workspaceId, ...row() } as never);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("idea conversion and plan helpers cannot target another workspace", async () => {
    const convert = await alice.client.rpc("convert_idea_to_goal", { idea_id: b.ideaId });
    expect(convert.error?.code).toBe("P0002");
    const add = await alice.client.rpc("add_goal_to_plan", {
      target_plan_id: b.yearPlanId,
      goal_title: "x",
    });
    expect(add.error?.code).toBe("P0002");
  });
});

describe("viewers are read-only", () => {
  it("can read but not write in a workspace they view", async () => {
    const admin = adminClient();
    await admin
      .from("workspace_members")
      .insert({ workspace_id: b.workspaceId, user_id: alice.id, role: "viewer" })
      .throwOnError();
    try {
      const read = await alice.client.from("goals").select("id").eq("id", b.goalId);
      expect(read.data).toHaveLength(1);
      for (const [table, row] of [
        ["goals", { workspace_id: b.workspaceId, title: "x" }],
        [
          "habit_logs",
          { workspace_id: b.workspaceId, habit_id: b.habitId, log_date: "2026-10-15", value: 1 },
        ],
        ["vision_board_items", { workspace_id: b.workspaceId, title: "x" }],
      ] as const) {
        const { error } = await alice.client.from(table).insert(row as never);
        expect(error?.code, table).toBe(INSUFFICIENT_PRIVILEGE);
      }
      const update = await alice.client
        .from("milestones")
        .update({ title: "hacked" })
        .eq("id", b.milestoneId)
        .select("id");
      expect(update.data).toEqual([]);
    } finally {
      await admin
        .from("workspace_members")
        .delete()
        .eq("workspace_id", b.workspaceId)
        .eq("user_id", alice.id);
    }
  });
});

describe("data rules", () => {
  const habit = (fields: Record<string, unknown>) =>
    alice.client.from("habits").insert({
      workspace_id: a.workspaceId,
      title: "x",
      starts_on: "2026-10-01",
      ...fields,
    } as never);

  it("validates habit kinds and schedules", async () => {
    expect((await habit({ kind: "measurable" })).error?.code).toBe(CHECK_VIOLATION);
    expect((await habit({ kind: "boolean", target_value: 5 })).error?.code).toBe(CHECK_VIOLATION);
    expect((await habit({ unit: "pages" })).error?.code).toBe(CHECK_VIOLATION);
    expect((await habit({ frequency: "weekly" })).error?.code).toBe(CHECK_VIOLATION);
    expect((await habit({ times_per_week: 3 })).error?.code).toBe(CHECK_VIOLATION);
    expect((await habit({ weekdays: [] })).error?.code).toBe(CHECK_VIOLATION);
    expect((await habit({ weekdays: [0, 8] })).error?.code).toBe(CHECK_VIOLATION);
    expect((await habit({ ends_on: "2026-09-01" })).error?.code).toBe(CHECK_VIOLATION);
    expect((await habit({ kind: "measurable", target_value: 20, unit: "pages" })).error).toBeNull();
    expect((await habit({ frequency: "weekly", times_per_week: 3 })).error).toBeNull();
  });

  it("keeps one log per habit per day, either a value or a rest day", async () => {
    const log = (fields: Record<string, unknown>) =>
      alice.client
        .from("habit_logs")
        .insert({ workspace_id: a.workspaceId, habit_id: a.habitId, ...fields } as never);
    expect((await log({ log_date: "2026-10-12", value: 1 })).error?.code).toBe(UNIQUE_VIOLATION);
    expect((await log({ log_date: "2026-10-20", rest: true, value: 1 })).error?.code).toBe(
      CHECK_VIOLATION,
    );
    expect((await log({ log_date: "2026-10-20" })).error?.code).toBe(CHECK_VIOLATION);
    expect((await log({ log_date: "2026-10-20", value: -1 })).error?.code).toBe(CHECK_VIOLATION);
    expect((await log({ log_date: "2026-10-20", rest: true })).error).toBeNull();
  });

  it("validates goals and cards", async () => {
    const goal = (fields: Record<string, unknown>) =>
      alice.client
        .from("goals")
        .insert({ workspace_id: a.workspaceId, title: "x", ...fields } as never);
    expect((await goal({ current_value: 3 })).error?.code).toBe(CHECK_VIOLATION);
    expect((await goal({ target_value: 0 })).error?.code).toBe(CHECK_VIOLATION);
    expect((await goal({ start_date: "2026-10-10", target_date: "2026-10-01" })).error?.code).toBe(
      CHECK_VIOLATION,
    );
    expect((await goal({ target_value: 24, current_value: 3, unit: "books" })).error).toBeNull();

    const empty = await alice.client
      .from("vision_board_items")
      .insert({ workspace_id: a.workspaceId });
    expect(empty.error?.code).toBe(CHECK_VIOLATION);
    // An image path must sit under the card's own workspace/card folder.
    const misplaced = await alice.client
      .from("vision_board_items")
      .update({ image_path: `${b.workspaceId}/${a.cardId}/x.png` })
      .eq("id", a.cardId);
    expect(misplaced.error?.code).toBe(CHECK_VIOLATION);
  });

  it("plan items still link exactly one thing", async () => {
    const both = await alice.client.from("plan_items").insert({
      workspace_id: a.workspaceId,
      plan_id: a.yearPlanId,
      goal_id: a.goalId,
      milestone_id: a.milestoneId,
    });
    expect(both.error?.code).toBe(CHECK_VIOLATION);
    const goalItem = await alice.client
      .from("plan_items")
      .insert({ workspace_id: a.workspaceId, plan_id: a.yearPlanId, goal_id: a.goalId });
    expect(goalItem.error).toBeNull();
    const again = await alice.client
      .from("plan_items")
      .insert({ workspace_id: a.workspaceId, plan_id: a.yearPlanId, goal_id: a.goalId });
    expect(again.error?.code).toBe(UNIQUE_VIOLATION);
  });
});

describe("goal links and functions", () => {
  async function goalWithLinks(db: TypedClient) {
    const goal = await one(
      db.from("goals").insert({ workspace_id: a.workspaceId, title: "Temp" }).select("id").single(),
    );
    const project = await one(
      db
        .from("projects")
        .insert({ workspace_id: a.workspaceId, name: "P", goal_id: goal.id })
        .select("id")
        .single(),
    );
    const task = await one(
      db
        .from("tasks")
        .insert({ workspace_id: a.workspaceId, title: "T", goal_id: goal.id })
        .select("id")
        .single(),
    );
    await db
      .from("milestones")
      .insert({ workspace_id: a.workspaceId, goal_id: goal.id, title: "M" });
    await db
      .from("plan_items")
      .insert({ workspace_id: a.workspaceId, plan_id: a.weekPlanId, goal_id: goal.id });
    return { goal: goal.id, project: project.id, task: task.id };
  }

  it("deleting a goal keeps linked work and unlinks it", async () => {
    const { goal, project, task } = await goalWithLinks(alice.client);
    await alice.client.from("goals").delete().eq("id", goal).throwOnError();
    const p = await alice.client.from("projects").select("goal_id").eq("id", project).single();
    const t = await alice.client.from("tasks").select("goal_id").eq("id", task).single();
    expect(p.data?.goal_id).toBeNull();
    expect(t.data?.goal_id).toBeNull();
    const milestones = await alice.client.from("milestones").select("id").eq("goal_id", goal);
    expect(milestones.data).toEqual([]);
    const items = await alice.client.from("plan_items").select("id").eq("goal_id", goal);
    expect(items.data).toEqual([]);
  });

  it("a recurring task keeps its goal in the next occurrence", async () => {
    const task = await one(
      alice.client
        .from("tasks")
        .insert({
          workspace_id: a.workspaceId,
          title: "Weekly run",
          goal_id: a.goalId,
          due_date: "2026-10-12",
          recurrence_frequency: "weekly",
          recurrence_interval: 1,
        })
        .select("id")
        .single(),
    );
    await alice.client.from("tasks").update({ status: "done" }).eq("id", task.id).throwOnError();
    const next = await alice.client
      .from("tasks")
      .select("goal_id, due_date")
      .eq("recurs_from_task_id", task.id)
      .single();
    expect(next.data).toEqual({ goal_id: a.goalId, due_date: "2026-10-19" });
  });

  it("converts an idea into a goal once, keeping its text", async () => {
    const idea = await one(
      alice.client
        .from("ideas")
        .insert({ workspace_id: a.workspaceId, title: "Learn Arabic", body: "Because family" })
        .select("id")
        .single(),
    );
    const first = await alice.client.rpc("convert_idea_to_goal", { idea_id: idea.id });
    const second = await alice.client.rpc("convert_idea_to_goal", { idea_id: idea.id });
    expect(first.error).toBeNull();
    expect(second.data).toBe(first.data);
    const goal = await alice.client
      .from("goals")
      .select("title, description")
      .eq("id", first.data!)
      .single();
    expect(goal.data).toEqual({ title: "Learn Arabic", description: "Because family" });
    const after = await alice.client
      .from("ideas")
      .select("status, converted_goal_id")
      .eq("id", idea.id)
      .single();
    expect(after.data).toEqual({ status: "archived", converted_goal_id: first.data });
  });

  it("adds a new goal to a plan in one step", async () => {
    const { data, error } = await alice.client.rpc("add_goal_to_plan", {
      target_plan_id: a.monthPlanId,
      goal_title: "Ship the book",
    });
    expect(error).toBeNull();
    const item = await alice.client
      .from("plan_items")
      .select("plan_id")
      .eq("goal_id", data!)
      .single();
    expect(item.data?.plan_id).toBe(a.monthPlanId);
  });
});

describe("vision-board storage", () => {
  const png = () =>
    new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
      type: "image/png",
    });
  const bucket = (db: TypedClient) => db.storage.from("vision-board");
  const path = (f: WorkspaceFixture & Phase4, name = "a.png") =>
    `${f.workspaceId}/${f.cardId}/${name}`;

  it("stores images privately under the card's folder", async () => {
    const upload = await bucket(alice.client).upload(path(a), png(), { contentType: "image/png" });
    expect(upload.error).toBeNull();
    // The bucket is private: no public URL works, but the owner can download and sign URLs.
    const own = await bucket(alice.client).download(path(a));
    expect(own.error).toBeNull();
    const signed = await bucket(alice.client).createSignedUrl(path(a), 60);
    expect(signed.error).toBeNull();
    const publicUrl = bucket(alice.client).getPublicUrl(path(a)).data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);
    const { data } = await adminClient().storage.getBucket("vision-board");
    expect(data?.public).toBe(false);
  });

  it("hides one workspace's images from another and from anonymous callers", async () => {
    await bucket(bob.client).upload(path(b), png(), { contentType: "image/png" });
    expect((await bucket(alice.client).download(path(b))).error).not.toBeNull();
    expect((await bucket(alice.client).createSignedUrl(path(b), 60)).error).not.toBeNull();
    expect((await bucket(publicClient()).download(path(b))).error).not.toBeNull();
    const listed = await bucket(alice.client).list(b.workspaceId);
    expect(listed.data ?? []).toEqual([]);
    // Removing someone else's object silently does nothing.
    await bucket(alice.client).remove([path(b)]);
    expect((await bucket(bob.client).download(path(b))).error).toBeNull();
  });

  it("rejects uploads outside an existing card, into another workspace, or of other file types", async () => {
    const strays = [
      `${a.workspaceId}/${crypto.randomUUID()}/x.png`, // no such card
      `${a.workspaceId}/x.png`, // not under a card
      `${b.workspaceId}/${b.cardId}/x.png`, // Bob's card
      `${a.workspaceId}/${b.cardId}/x.png`, // Bob's card under Alice's folder
    ];
    for (const stray of strays) {
      const { error } = await bucket(alice.client).upload(stray, png(), {
        contentType: "image/png",
      });
      expect(error, stray).not.toBeNull();
    }
    const svg = await bucket(alice.client).upload(
      path(a, "x.svg"),
      new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/svg+xml" }),
      { contentType: "image/svg+xml" },
    );
    expect(svg.error).not.toBeNull();
    const big = await bucket(alice.client).upload(
      path(a, "big.png"),
      new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }),
      { contentType: "image/png" },
    );
    expect(big.error).not.toBeNull();
  });

  it("lets viewers see images but not change them", async () => {
    const admin = adminClient();
    await admin
      .from("workspace_members")
      .insert({ workspace_id: b.workspaceId, user_id: alice.id, role: "viewer" })
      .throwOnError();
    try {
      expect((await bucket(alice.client).download(path(b))).error).toBeNull();
      const upload = await bucket(alice.client).upload(path(b, "v.png"), png(), {
        contentType: "image/png",
      });
      expect(upload.error).not.toBeNull();
      await bucket(alice.client).remove([path(b)]);
      expect((await bucket(bob.client).download(path(b))).error).toBeNull();
    } finally {
      await admin
        .from("workspace_members")
        .delete()
        .eq("workspace_id", b.workspaceId)
        .eq("user_id", alice.id);
    }
  });

  it("lets the owner remove their image", async () => {
    await bucket(alice.client).remove([path(a)]);
    expect((await bucket(alice.client).download(path(a))).error).not.toBeNull();
  });
});
