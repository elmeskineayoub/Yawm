import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteAreaInWorkspace,
  moveAreaInWorkspace,
  updateAreaInWorkspace,
} from "@/features/areas/mutations";
import {
  convertIdeaInWorkspace,
  deleteIdeaInWorkspace,
  setIdeaStatusInWorkspace,
  updateIdeaInWorkspace,
} from "@/features/inbox/mutations";
import {
  unlinkPlanItemInWorkspace,
  updatePlanNotesInWorkspace,
} from "@/features/planning/mutations";
import { deleteProjectInWorkspace, updateProjectInWorkspace } from "@/features/projects/mutations";
import {
  addDependencyInWorkspace,
  deleteTaskInWorkspace,
  removeDependencyInWorkspace,
  setTaskStatusInWorkspace,
  updateTaskInWorkspace,
} from "@/features/tasks/mutations";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  personalWorkspaceId,
  seedWorkspace,
  type TestUser,
  type WorkspaceFixture,
} from "./helpers";

/*
 * Regression tests for the server-action mutation layer. Alice is a *writer* in Bob's workspace,
 * so RLS alone would let her change Bob's rows. The app's active workspace for Alice is her
 * personal one; an ID from Bob's workspace passed to a server action must not change anything.
 */

let alice: TestUser;
let bob: TestUser;
let aliceWorkspace: string;
let b: WorkspaceFixture;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-scope");
  bob = await createConfirmedUser("bob-scope");
  aliceWorkspace = await personalWorkspaceId(alice.id);
  b = await seedWorkspace(bob);
  const { error } = await adminClient()
    .from("workspace_members")
    .insert({ workspace_id: b.workspaceId, user_id: alice.id, role: "member" });
  if (error) throw error;
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

async function row(table: "tasks" | "ideas" | "projects" | "areas" | "plans", id: string) {
  const { data } = await adminClient().from(table).select("*").eq("id", id).maybeSingle();
  return data as Record<string, unknown> | null;
}

describe("precondition", () => {
  it("RLS alone lets Alice write to Bob's workspace (she is a member there)", async () => {
    const { data: control } = await bob.client
      .from("tasks")
      .insert({ workspace_id: b.workspaceId, title: "Control" })
      .select()
      .single();
    const { data, error } = await alice.client
      .from("tasks")
      .update({ title: "Changed by Alice" })
      .eq("id", control!.id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("mutations with Alice's personal workspace active and Bob's IDs", () => {
  it("tasks: update, status, delete are refused and leave the task unchanged", async () => {
    const before = await row("tasks", b.blockerId);

    const update = await updateTaskInWorkspace(
      alice.client,
      aliceWorkspace,
      b.blockerId,
      { title: "Hijacked" },
      ["stolen"],
    );
    expect(update).toEqual({ ok: false, error: "This task no longer exists." });

    const status = await setTaskStatusInWorkspace(
      alice.client,
      aliceWorkspace,
      b.blockerId,
      "done",
    );
    expect(status.ok).toBe(false);

    const remove = await deleteTaskInWorkspace(alice.client, aliceWorkspace, b.blockerId);
    expect(remove.ok).toBe(false);

    expect(await row("tasks", b.blockerId)).toEqual(before);
    const { data: tags } = await adminClient()
      .from("task_tags")
      .select("tag_id")
      .eq("task_id", b.blockerId);
    expect(tags).toEqual([]);
  });

  it("tasks: dependencies cannot be added or removed", async () => {
    const add = await addDependencyInWorkspace(
      alice.client,
      aliceWorkspace,
      b.subtaskId,
      b.blockerId,
    );
    expect(add.ok).toBe(false);

    const remove = await removeDependencyInWorkspace(
      alice.client,
      aliceWorkspace,
      b.taskId,
      b.blockerId,
    );
    expect(remove.ok).toBe(false);

    const { data } = await adminClient()
      .from("task_dependencies")
      .select("task_id, depends_on_task_id")
      .eq("workspace_id", b.workspaceId);
    expect(data).toEqual([{ task_id: b.taskId, depends_on_task_id: b.blockerId }]);
  });

  it("ideas: update, status, delete, and conversion are refused", async () => {
    const before = await row("ideas", b.ideaId);

    expect(
      (await updateIdeaInWorkspace(alice.client, aliceWorkspace, b.ideaId, { title: "x" }, [])).ok,
    ).toBe(false);
    expect(
      (await setIdeaStatusInWorkspace(alice.client, aliceWorkspace, b.ideaId, "archived")).ok,
    ).toBe(false);
    expect((await deleteIdeaInWorkspace(alice.client, aliceWorkspace, b.ideaId)).ok).toBe(false);
    expect((await convertIdeaInWorkspace(alice.client, aliceWorkspace, b.ideaId, "task")).ok).toBe(
      false,
    );
    expect(
      (await convertIdeaInWorkspace(alice.client, aliceWorkspace, b.ideaId, "project")).ok,
    ).toBe(false);

    expect(await row("ideas", b.ideaId)).toEqual(before);
    // The tags were not cleared by the refused update either.
    const { data: tags } = await adminClient()
      .from("idea_tags")
      .select("tag_id")
      .eq("idea_id", b.ideaId);
    expect(tags).toHaveLength(1);
  });

  it("projects: update and delete are refused", async () => {
    const before = await row("projects", b.projectId);
    expect(
      (await updateProjectInWorkspace(alice.client, aliceWorkspace, b.projectId, { name: "x" })).ok,
    ).toBe(false);
    expect((await deleteProjectInWorkspace(alice.client, aliceWorkspace, b.projectId)).ok).toBe(
      false,
    );
    expect(await row("projects", b.projectId)).toEqual(before);
  });

  it("areas: update, archive, reorder, and delete are refused", async () => {
    const before = await row("areas", b.areaId);
    expect(
      (await updateAreaInWorkspace(alice.client, aliceWorkspace, b.areaId, { name: "x" })).ok,
    ).toBe(false);
    expect(
      (
        await updateAreaInWorkspace(alice.client, aliceWorkspace, b.areaId, {
          archived_at: new Date().toISOString(),
        })
      ).ok,
    ).toBe(false);
    expect((await moveAreaInWorkspace(alice.client, aliceWorkspace, b.areaId, "up")).ok).toBe(
      false,
    );
    expect((await deleteAreaInWorkspace(alice.client, aliceWorkspace, b.areaId)).ok).toBe(false);
    expect(await row("areas", b.areaId)).toEqual(before);
  });

  it("plans: notes cannot be edited and linked items cannot be removed", async () => {
    const before = await row("plans", b.dayPlanId);
    expect(
      (
        await updatePlanNotesInWorkspace(alice.client, aliceWorkspace, b.dayPlanId, {
          theme: "x",
        })
      ).ok,
    ).toBe(false);
    expect((await unlinkPlanItemInWorkspace(alice.client, aliceWorkspace, b.planItemId)).ok).toBe(
      false,
    );
    expect(await row("plans", b.dayPlanId)).toEqual(before);
    const { data } = await adminClient().from("plan_items").select("id").eq("id", b.planItemId);
    expect(data).toHaveLength(1);
  });
});

describe("the same mutations succeed inside the active workspace", () => {
  it("works on Alice's own rows", async () => {
    const { data: task } = await alice.client
      .from("tasks")
      .insert({ workspace_id: aliceWorkspace, title: "Mine" })
      .select()
      .single();
    expect(await setTaskStatusInWorkspace(alice.client, aliceWorkspace, task!.id, "done")).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await deleteTaskInWorkspace(alice.client, aliceWorkspace, task!.id)).toEqual({
      ok: true,
      data: undefined,
    });
  });

  it("works on Bob's rows when Bob's workspace is the active one", async () => {
    // Proves the refusals above come from the workspace scope, not from missing permissions.
    const result = await updateProjectInWorkspace(alice.client, b.workspaceId, b.projectId, {
      notes: "Shared edit",
    });
    expect(result.ok).toBe(true);
    expect((await row("projects", b.projectId))?.notes).toBe("Shared edit");
  });
});
