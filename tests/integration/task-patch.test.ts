import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  patchTaskInWorkspace,
  setTaskDueDateInWorkspace,
  setTaskTagsInWorkspace,
} from "@/features/tasks/mutations";
import { createConfirmedUser, deleteUsers, personalWorkspaceId, type TestUser } from "./helpers";

/*
 * Field-by-field task saves (task detail autosave): writes stay inside the caller's active
 * workspace, and another user's task behaves exactly like a missing one.
 */

let alice: TestUser;
let bob: TestUser;
let aliceWs: string;
let bobWs: string;
let aliceTask: string;
let bobTask: string;

beforeAll(async () => {
  alice = await createConfirmedUser("patch-a");
  bob = await createConfirmedUser("patch-b");
  aliceWs = await personalWorkspaceId(alice.id);
  bobWs = await personalWorkspaceId(bob.id);
  aliceTask = (
    await alice.client
      .from("tasks")
      .insert({ workspace_id: aliceWs, title: "Alice" })
      .select("id")
      .single()
      .throwOnError()
  ).data!.id;
  bobTask = (
    await bob.client
      .from("tasks")
      .insert({ workspace_id: bobWs, title: "Bob" })
      .select("id")
      .single()
      .throwOnError()
  ).data!.id;
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

describe("patchTaskInWorkspace", () => {
  it("updates the caller's own task", async () => {
    const result = await patchTaskInWorkspace(alice.client, aliceWs, aliceTask, {
      priority: "urgent",
    });
    expect(result.ok).toBe(true);
    const { data } = await alice.client
      .from("tasks")
      .select("priority")
      .eq("id", aliceTask)
      .single();
    expect(data?.priority).toBe("urgent");
  });

  it("cannot touch another user's task, even with their workspace id", async () => {
    expect((await patchTaskInWorkspace(alice.client, aliceWs, bobTask, { title: "x" })).ok).toBe(
      false,
    );
    expect((await patchTaskInWorkspace(alice.client, bobWs, bobTask, { title: "x" })).ok).toBe(
      false,
    );
    const { data } = await bob.client.from("tasks").select("title").eq("id", bobTask).single();
    expect(data?.title).toBe("Bob");
  });
});

describe("setTaskTagsInWorkspace", () => {
  it("sets the caller's tags and refuses another user's task", async () => {
    expect((await setTaskTagsInWorkspace(alice.client, aliceWs, aliceTask, ["deep work"])).ok).toBe(
      true,
    );
    const tags = await alice.client.from("task_tags").select("tag_id").eq("task_id", aliceTask);
    expect(tags.data).toHaveLength(1);

    expect((await setTaskTagsInWorkspace(alice.client, aliceWs, bobTask, ["mine"])).ok).toBe(false);
    const bobTags = await bob.client.from("task_tags").select("tag_id").eq("task_id", bobTask);
    expect(bobTags.data).toHaveLength(0);
  });
});

describe("setTaskDueDateInWorkspace (used by Today's Move all to today)", () => {
  it("moves the caller's deadline and refuses another user's task", async () => {
    expect(
      (await setTaskDueDateInWorkspace(alice.client, aliceWs, aliceTask, "2026-11-05")).ok,
    ).toBe(true);
    expect((await setTaskDueDateInWorkspace(alice.client, aliceWs, bobTask, "2026-11-05")).ok).toBe(
      false,
    );
    const { data } = await bob.client.from("tasks").select("due_date").eq("id", bobTask).single();
    expect(data?.due_date).toBeNull();
  });
});
