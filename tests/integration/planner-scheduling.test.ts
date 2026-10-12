import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createBlockInWorkspace,
  deleteBlockInWorkspace,
  findOverlaps,
  updateBlockInWorkspace,
} from "@/features/calendar/mutations";
import { needsRescheduling } from "@/features/calendar/logic";
import { loadSchedulingState } from "@/features/calendar/queries";
import {
  carryForwardInWorkspace,
  ensurePlanInWorkspace,
  linkToPlanInWorkspace,
} from "@/features/planning/mutations";
import { setTaskDueDateInWorkspace } from "@/features/tasks/mutations";
import type { WorkspaceContext } from "@/lib/workspace-context";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  personalWorkspaceId,
  seedWorkspace,
  type TestUser,
  type WorkspaceFixture,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let ws: string;
let b: WorkspaceFixture;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-sched");
  bob = await createConfirmedUser("bob-sched");
  ws = await personalWorkspaceId(alice.id);
  b = await seedWorkspace(bob);
  // Alice can write in Bob's workspace, but her active workspace is her own.
  await adminClient()
    .from("workspace_members")
    .insert({ workspace_id: b.workspaceId, user_id: alice.id, role: "member" })
    .throwOnError();
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

const t = (time: string) => `2026-10-14T${time}:00.000Z`;

async function newTask(title: string, fields: Record<string, unknown> = {}) {
  const { data, error } = await alice.client
    .from("tasks")
    .insert({ workspace_id: ws, title, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("time block mutations", () => {
  it("creates, moves, and resizes a block and reports overlaps", async () => {
    const first = await createBlockInWorkspace(alice.client, ws, {
      title: "Writing",
      starts_at: t("09:00"),
      ends_at: t("10:00"),
      timezone: "Europe/London",
    });
    expect(first).toMatchObject({ ok: true, data: { overlaps: [] } });

    const second = await createBlockInWorkspace(alice.client, ws, {
      title: "Call",
      starts_at: t("09:30"),
      ends_at: t("09:45"),
      timezone: "Europe/London",
    });
    expect(second.ok && second.data.overlaps.map((o) => o.title)).toEqual(["Writing"]);

    // Move the call so it only touches the writing block: no overlap.
    const moved = await updateBlockInWorkspace(alice.client, ws, second.ok ? second.data.id : "", {
      starts_at: t("10:00"),
      ends_at: t("10:30"),
    });
    expect(moved).toMatchObject({ ok: true, data: { overlaps: [] } });

    // Resize writing to run past 10:00: it now overlaps the call.
    const resized = await updateBlockInWorkspace(alice.client, ws, first.ok ? first.data.id : "", {
      ends_at: t("10:15"),
    });
    expect(resized.ok && resized.data.overlaps.map((o) => o.title)).toEqual(["Call"]);

    expect(
      (await findOverlaps(alice.client, ws, { starts_at: t("08:00"), ends_at: t("09:00") })).length,
    ).toBe(0);
  });

  it("schedules a task without touching its deadline", async () => {
    const taskId = await newTask("Report", { due_date: "2026-10-20" });
    const result = await createBlockInWorkspace(alice.client, ws, {
      title: "Report",
      starts_at: t("13:00"),
      ends_at: t("14:00"),
      timezone: "UTC",
      task_id: taskId,
    });
    expect(result.ok).toBe(true);
    const { data } = await alice.client.from("tasks").select("due_date").eq("id", taskId).single();
    expect(data?.due_date).toBe("2026-10-20");
  });

  it("refuses another workspace's blocks and tasks even with write membership there", async () => {
    const { data: bobBlock } = await bob.client
      .from("time_blocks")
      .insert({
        workspace_id: b.workspaceId,
        title: "Bob's block",
        starts_at: t("09:00"),
        ends_at: t("10:00"),
        timezone: "UTC",
      })
      .select()
      .single();

    const move = await updateBlockInWorkspace(alice.client, ws, bobBlock!.id, {
      starts_at: t("11:00"),
      ends_at: t("12:00"),
    });
    expect(move).toEqual({ ok: false, error: "This block no longer exists." });
    expect((await deleteBlockInWorkspace(alice.client, ws, bobBlock!.id)).ok).toBe(false);

    const link = await createBlockInWorkspace(alice.client, ws, {
      title: "Steal",
      starts_at: t("09:00"),
      ends_at: t("10:00"),
      timezone: "UTC",
      task_id: b.taskId,
    });
    expect(link.ok).toBe(false);

    // Bob's block is not reported as an overlap in Alice's workspace.
    const overlaps = await findOverlaps(alice.client, ws, {
      starts_at: t("09:00"),
      ends_at: t("10:00"),
    });
    expect(overlaps.map((o) => o.title)).not.toContain("Bob's block");

    const { data } = await adminClient()
      .from("time_blocks")
      .select("starts_at")
      .eq("id", bobBlock!.id)
      .single();
    expect(new Date(data!.starts_at).toISOString()).toBe(t("09:00"));

    const deadline = await setTaskDueDateInWorkspace(alice.client, ws, b.taskId, "2030-01-01");
    expect(deadline.ok).toBe(false);
  });
});

describe("planning at any level", () => {
  it("creates a week plan without any month or year plan", async () => {
    const week = await ensurePlanInWorkspace(alice.client, ws, 1, {
      period: "week",
      start: "2027-05-10",
    });
    expect(week.ok).toBe(true);
    const { data } = await alice.client
      .from("plans")
      .select("period, parent_plan_id")
      .eq("workspace_id", ws)
      .eq("period_start", "2027-05-10");
    expect(data).toEqual([{ period: "week", parent_plan_id: null }]);
  });

  it("links parents later when they are created, and reuses existing plans", async () => {
    const week = await ensurePlanInWorkspace(alice.client, ws, 1, {
      period: "week",
      start: "2027-06-07",
    });
    const month = await ensurePlanInWorkspace(alice.client, ws, 1, {
      period: "month",
      start: "2027-06-01",
    });
    const again = await ensurePlanInWorkspace(alice.client, ws, 1, {
      period: "week",
      start: "2027-06-07",
    });
    expect(again.ok && week.ok && again.data.id === week.data.id).toBe(true);
    const { data } = await alice.client
      .from("plans")
      .select("parent_plan_id")
      .eq("id", week.ok ? week.data.id : "")
      .single();
    expect(data?.parent_plan_id).toBe(month.ok ? month.data.id : null);
  });
});

describe("carry forward", () => {
  it("links only unfinished task priorities to the next period, once, keeping due dates", async () => {
    const week = await ensurePlanInWorkspace(alice.client, ws, 1, {
      period: "week",
      start: "2027-03-01",
    });
    const planId = week.ok ? week.data.id : "";
    const open = await newTask("Open priority", { due_date: "2027-03-03" });
    const done = await newTask("Done priority");
    await alice.client.from("tasks").update({ status: "done" }).eq("id", done).throwOnError();
    const { data: project } = await alice.client
      .from("projects")
      .insert({ workspace_id: ws, name: "Project priority" })
      .select()
      .single();
    for (const link of [{ task_id: open }, { task_id: done }, { project_id: project!.id }]) {
      expect((await linkToPlanInWorkspace(alice.client, ws, planId, link)).ok).toBe(true);
    }

    const result = await carryForwardInWorkspace(alice.client, ws, 1, {
      period: "week",
      start: "2027-03-01",
    });
    expect(result).toMatchObject({
      ok: true,
      data: { moved: 1, next: { period: "week", start: "2027-03-08" } },
    });

    const again = await carryForwardInWorkspace(alice.client, ws, 1, {
      period: "week",
      start: "2027-03-01",
    });
    expect(again).toMatchObject({ ok: true, data: { moved: 0 } });

    const { data: nextPlan } = await alice.client
      .from("plans")
      .select("id")
      .eq("workspace_id", ws)
      .eq("period", "week")
      .eq("period_start", "2027-03-08")
      .single();
    const { data: items } = await alice.client
      .from("plan_items")
      .select("task_id")
      .eq("plan_id", nextPlan!.id);
    expect(items).toEqual([{ task_id: open }]);

    // The original plan keeps its links, and the deadline is unchanged.
    const { count } = await alice.client
      .from("plan_items")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);
    expect(count).toBe(3);
    const { data: task } = await alice.client
      .from("tasks")
      .select("due_date")
      .eq("id", open)
      .single();
    expect(task?.due_date).toBe("2027-03-03");
  });

  it("does nothing when the period has no plan", async () => {
    const result = await carryForwardInWorkspace(alice.client, ws, 1, {
      period: "day",
      start: "2031-01-01",
    });
    expect(result).toMatchObject({ ok: true, data: { moved: 0 } });
  });
});

describe("moving a deadline", () => {
  it("changes only when asked, and clearing it also clears the time", async () => {
    const taskId = await newTask("Movable", { due_date: "2026-10-10", due_time: "09:00" });
    expect((await setTaskDueDateInWorkspace(alice.client, ws, taskId, "2026-10-15")).ok).toBe(true);
    let { data } = await alice.client
      .from("tasks")
      .select("due_date, due_time")
      .eq("id", taskId)
      .single();
    expect(data).toEqual({ due_date: "2026-10-15", due_time: "09:00:00" });

    expect((await setTaskDueDateInWorkspace(alice.client, ws, taskId, null)).ok).toBe(true);
    ({ data } = await alice.client
      .from("tasks")
      .select("due_date, due_time")
      .eq("id", taskId)
      .single());
    expect(data).toEqual({ due_date: null, due_time: null });
  });

  it("explains why a repeating task's deadline cannot be cleared", async () => {
    const taskId = await newTask("Repeats", {
      due_date: "2026-10-10",
      recurrence_frequency: "daily",
    });
    expect(await setTaskDueDateInWorkspace(alice.client, ws, taskId, null)).toEqual({
      ok: false,
      error: "A repeating task needs a due date.",
    });
  });
});

describe("scheduling state", () => {
  it("keeps a task whose only block was months ago in Needs rescheduling", async () => {
    const taskId = await newTask("Old missed work");
    await createBlockInWorkspace(alice.client, ws, {
      title: "Old missed work",
      starts_at: "2026-03-02T09:00:00.000Z",
      ends_at: "2026-03-02T10:00:00.000Z",
      timezone: "UTC",
      task_id: taskId,
    });
    const ctx: WorkspaceContext = {
      supabase: alice.client,
      user: { id: alice.id, email: alice.email },
      workspace: { id: ws, name: "Personal", is_personal: true },
      timezone: "UTC",
      weekStart: 1,
      today: "2026-10-14",
    };
    const state = await loadSchedulingState(ctx);
    expect(state.blocks.some((b) => b.task_id === taskId)).toBe(true);
    const reschedule = needsRescheduling(
      state.tasks,
      state.blocks,
      new Date("2026-10-14T12:00:00Z"),
      "2026-10-14",
    );
    expect(reschedule.find((r) => r.task.id === taskId)?.reasons).toEqual(["missed_block"]);
  });
});
