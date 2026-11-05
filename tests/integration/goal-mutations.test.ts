import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createGoalInWorkspace,
  createMilestoneInWorkspace,
  deleteGoalInWorkspace,
  moveMilestoneInWorkspace,
  setGoalLinkInWorkspace,
  updateGoalInWorkspace,
  updateMilestoneInWorkspace,
} from "@/features/goals/mutations";
import { loadGoalSummaries } from "@/features/goals/queries";
import type { WorkspaceContext } from "@/lib/workspace-context";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  personalWorkspaceId,
  type TestUser,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let ws: string;
let bobWs: string;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-goals");
  bob = await createConfirmedUser("bob-goals");
  [ws, bobWs] = await Promise.all([personalWorkspaceId(alice.id), personalWorkspaceId(bob.id)]);
  await adminClient()
    .from("workspace_members")
    .insert({ workspace_id: bobWs, user_id: alice.id, role: "member" })
    .throwOnError();
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

async function goal(title = "Get fit", db = alice.client, workspace = ws) {
  const result = await createGoalInWorkspace(db, workspace, title);
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

async function milestone(goalId: string, title: string) {
  const result = await createMilestoneInWorkspace(alice.client, ws, goalId, title);
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

async function order(goalId: string) {
  const { data } = await adminClient()
    .from("milestones")
    .select("title")
    .eq("goal_id", goalId)
    .order("sort_order");
  return data?.map((m) => m.title);
}

const ctx = () =>
  ({
    supabase: alice.client,
    user: { id: alice.id, email: alice.email },
    workspace: { id: ws, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: "2026-10-12",
  }) as WorkspaceContext;

describe("creating a goal with details", () => {
  it("saves why, area, and target date from the New goal form", async () => {
    const area = (
      await alice.client.from("areas").select("id").eq("workspace_id", ws).limit(1).single()
    ).data!.id;
    const result = await createGoalInWorkspace(alice.client, ws, "Learn Spanish", {
      why: "Talk with my neighbours.",
      area_id: area,
      target_date: "2027-06-30",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data } = await alice.client
      .from("goals")
      .select("title, why, area_id, target_date")
      .eq("id", result.data.id)
      .single();
    expect(data).toEqual({
      title: "Learn Spanish",
      why: "Talk with my neighbours.",
      area_id: area,
      target_date: "2027-06-30",
    });
  });

  it("rejects a life area from another workspace", async () => {
    const bobArea = (
      await bob.client.from("areas").select("id").eq("workspace_id", bobWs).limit(1).single()
    ).data!.id;
    const result = await createGoalInWorkspace(alice.client, ws, "Sneaky", { area_id: bobArea });
    expect(result.ok).toBe(false);
  });
});

describe("milestones", () => {
  it("are added in order and can be moved up and down", async () => {
    const g = await goal();
    for (const t of ["A", "B", "C"]) await milestone(g, t);
    expect(await order(g)).toEqual(["A", "B", "C"]);
    const c = (
      await adminClient().from("milestones").select("id").eq("goal_id", g).eq("title", "C").single()
    ).data!.id;
    await moveMilestoneInWorkspace(alice.client, ws, c, "up");
    expect(await order(g)).toEqual(["A", "C", "B"]);
    await moveMilestoneInWorkspace(alice.client, ws, c, "up");
    await moveMilestoneInWorkspace(alice.client, ws, c, "up"); // already first: no-op
    expect(await order(g)).toEqual(["C", "A", "B"]);
  });

  it("can't be added to another workspace's goal from the active workspace", async () => {
    const bobGoal = await goal("Bob's", bob.client, bobWs);
    const result = await createMilestoneInWorkspace(alice.client, ws, bobGoal, "x");
    expect(result).toEqual({ ok: false, error: "This goal no longer exists." });
  });
});

describe("goal progress from linked work", () => {
  it("counts milestones, the measure, and tasks via projects or directly", async () => {
    const g = await goal("Write a book");
    await updateGoalInWorkspace(alice.client, ws, g, {
      target_value: 60000,
      current_value: 15000,
      unit: "words",
    });
    const m1 = await milestone(g, "Outline");
    await milestone(g, "Draft");
    await updateMilestoneInWorkspace(alice.client, ws, m1, {
      completed_at: new Date().toISOString(),
    });
    const project = (
      await alice.client
        .from("projects")
        .insert({ workspace_id: ws, name: "Chapters" })
        .select("id")
        .single()
    ).data!.id;
    expect(await setGoalLinkInWorkspace(alice.client, ws, "project", project, g)).toEqual({
      ok: true,
      data: undefined,
    });
    await alice.client
      .from("tasks")
      .insert([
        { workspace_id: ws, title: "Ch 1", project_id: project, status: "done" },
        { workspace_id: ws, title: "Ch 2", project_id: project, status: "todo" },
        { workspace_id: ws, title: "Research", goal_id: g, status: "done" },
      ])
      .throwOnError();

    const [summary] = await loadGoalSummaries(ctx(), { ids: [g] });
    expect(summary!.progress).toEqual({
      milestones: { done: 1, total: 2, percent: 50 },
      measure: { current: 15000, target: 60000, unit: "words", percent: 25 },
      work: { done: 2, total: 3, percent: 67 },
    });
    expect(summary!.next?.title).toBe("Draft");
    expect(summary!.projectCount).toBe(1);
  });

  it("refuses links to another workspace's goal or work", async () => {
    const bobGoal = await goal("Bob's", bob.client, bobWs);
    const task = (
      await alice.client
        .from("tasks")
        .insert({ workspace_id: ws, title: "T" })
        .select("id")
        .single()
    ).data!.id;
    expect(await setGoalLinkInWorkspace(alice.client, ws, "task", task, bobGoal)).toEqual({
      ok: false,
      error: "This goal no longer exists.",
    });
    const bobTask = (
      await bob.client
        .from("tasks")
        .insert({ workspace_id: bobWs, title: "B" })
        .select("id")
        .single()
    ).data!.id;
    const own = await goal();
    expect(await setGoalLinkInWorkspace(alice.client, ws, "task", bobTask, own)).toEqual({
      ok: false,
      error: "This task no longer exists.",
    });
  });

  it("can't edit or delete another workspace's goal through the active workspace", async () => {
    const bobGoal = await goal("Bob's", bob.client, bobWs);
    expect(await updateGoalInWorkspace(alice.client, ws, bobGoal, { title: "x" })).toMatchObject({
      ok: false,
    });
    expect(await deleteGoalInWorkspace(alice.client, ws, bobGoal)).toMatchObject({ ok: false });
    const { data } = await adminClient().from("goals").select("title").eq("id", bobGoal).single();
    expect(data?.title).toBe("Bob's");
  });
});
