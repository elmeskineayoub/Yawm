import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { taskReminderKey } from "@/features/reminders/logic";
import {
  dismissReminderInWorkspace,
  setReminderPreferencesInWorkspace,
} from "@/features/reminders/mutations";
import { loadReminderPreferences, loadReminders } from "@/features/reminders/queries";
import type { WorkspaceContext } from "@/lib/workspace-context";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  personalWorkspaceId,
  type TestUser,
} from "./helpers";

const INSUFFICIENT_PRIVILEGE = "42501";

let alice: TestUser;
let carol: TestUser;
let ws: string;
let carolWs: string;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-rem");
  carol = await createConfirmedUser("carol-rem");
  [ws, carolWs] = await Promise.all([personalWorkspaceId(alice.id), personalWorkspaceId(carol.id)]);
});

afterAll(async () => {
  await deleteUsers(alice, carol);
});

const ctx = (): WorkspaceContext =>
  ({
    supabase: alice.client,
    user: { id: alice.id, email: alice.email },
    workspace: { id: ws, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: "2026-10-20",
  }) as WorkspaceContext;

async function overdueTask(title: string) {
  const { data } = await alice.client
    .from("tasks")
    .insert({ workspace_id: ws, title, due_date: "2026-10-19", status: "todo" })
    .select("id")
    .single();
  return data!.id;
}

describe("reminders", () => {
  it("derives a reminder from an overdue task and removes it once dismissed", async () => {
    const taskId = await overdueTask("File taxes");
    const key = taskReminderKey(taskId);

    const before = await loadReminders(ctx());
    expect(before.some((r) => r.key === key)).toBe(true);

    expect(await dismissReminderInWorkspace(alice.client, ws, key)).toMatchObject({ ok: true });
    const after = await loadReminders(ctx());
    expect(after.some((r) => r.key === key)).toBe(false);
  });

  it("dismissing the same reminder twice does not duplicate", async () => {
    const taskId = await overdueTask("Call bank");
    const key = taskReminderKey(taskId);
    await dismissReminderInWorkspace(alice.client, ws, key);
    expect(await dismissReminderInWorkspace(alice.client, ws, key)).toMatchObject({ ok: true });
    const { count } = await adminClient()
      .from("reminder_dismissals")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws)
      .eq("reminder_key", key);
    expect(count).toBe(1);
  });

  it("switching a category off hides it and persists the preference", async () => {
    await overdueTask("Renew passport");
    expect(
      await setReminderPreferencesInWorkspace(alice.client, ws, {
        task: false,
        habit: true,
        time_block: true,
      }),
    ).toMatchObject({ ok: true });

    expect(await loadReminderPreferences(ctx())).toEqual({
      task: false,
      habit: true,
      time_block: true,
    });
    const reminders = await loadReminders(ctx());
    expect(reminders.some((r) => r.category === "task")).toBe(false);

    // Restore for cleanliness.
    await setReminderPreferencesInWorkspace(alice.client, ws, {
      task: true,
      habit: true,
      time_block: true,
    });
  });
});

describe("isolation", () => {
  it("rejects dismissals and preferences written into a non-member workspace", async () => {
    const insert = await alice.client
      .from("reminder_dismissals")
      .insert({ workspace_id: carolWs, reminder_key: "task:x" } as never);
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);

    expect(
      await setReminderPreferencesInWorkspace(alice.client, carolWs, {
        task: false,
        habit: false,
        time_block: false,
      }),
    ).toMatchObject({ ok: false });
  });
});
