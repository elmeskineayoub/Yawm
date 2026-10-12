import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createHabitInWorkspace,
  deleteHabitInWorkspace,
  setHabitLogInWorkspace,
  updateHabitInWorkspace,
} from "@/features/habits/mutations";
import { habitSchema } from "@/features/habits/schemas";
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
const today = "2026-10-12";

beforeAll(async () => {
  alice = await createConfirmedUser("alice-habits");
  bob = await createConfirmedUser("bob-habits");
  [ws, bobWs] = await Promise.all([personalWorkspaceId(alice.id), personalWorkspaceId(bob.id)]);
  // Alice can write in Bob's workspace, but her active workspace is her own.
  await adminClient()
    .from("workspace_members")
    .insert({ workspace_id: bobWs, user_id: alice.id, role: "member" })
    .throwOnError();
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

async function newHabit(db = alice.client, workspace = ws, fields: object = {}) {
  const input = habitSchema.parse({ title: "Read", starts_on: "2026-10-01", ...fields });
  const result = await createHabitInWorkspace(db, workspace, input);
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

async function logs(habitId: string) {
  const { data } = await adminClient()
    .from("habit_logs")
    .select("log_date, value, rest")
    .eq("habit_id", habitId)
    .order("log_date");
  return data;
}

describe("recording habit days", () => {
  it("marks, changes, rests, and clears a day, keeping one row", async () => {
    const id = await newHabit();
    const set = (entry: Parameters<typeof setHabitLogInWorkspace>[4], date = today) =>
      setHabitLogInWorkspace(alice.client, ws, id, date, entry, today);

    expect(await set({ type: "value", value: 1 })).toEqual({ ok: true, data: undefined });
    expect(await set({ type: "value", value: 1 })).toMatchObject({ ok: true });
    expect(await logs(id)).toEqual([{ log_date: today, value: 1, rest: false }]);

    expect(await set({ type: "rest" })).toMatchObject({ ok: true });
    expect(await logs(id)).toEqual([{ log_date: today, value: null, rest: true }]);

    // Past days can be corrected.
    expect(await set({ type: "value", value: 1 }, "2026-10-05")).toMatchObject({ ok: true });
    expect(await set({ type: "clear" })).toMatchObject({ ok: true });
    expect(await logs(id)).toEqual([{ log_date: "2026-10-05", value: 1, rest: false }]);
  });

  it("keeps one row when the same day is saved twice at once", async () => {
    const id = await newHabit();
    const results = await Promise.all(
      [1, 2, 3].map((value) =>
        setHabitLogInWorkspace(alice.client, ws, id, today, { type: "value", value }, today),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await logs(id)).toHaveLength(1);
  });

  it("refuses days after today", async () => {
    const id = await newHabit();
    const result = await setHabitLogInWorkspace(
      alice.client,
      ws,
      id,
      "2026-10-13",
      { type: "value", value: 1 },
      today,
    );
    expect(result).toEqual({ ok: false, error: "You can only record today or earlier." });
    expect(await logs(id)).toEqual([]);
  });

  it("stores measurable amounts as numbers", async () => {
    const id = await newHabit(alice.client, ws, {
      kind: "measurable",
      target_value: "20",
      unit: "pages",
    });
    await setHabitLogInWorkspace(
      alice.client,
      ws,
      id,
      today,
      { type: "value", value: 12.5 },
      today,
    );
    expect(await logs(id)).toEqual([{ log_date: today, value: 12.5, rest: false }]);
  });
});

describe("workspace scoping", () => {
  it("can't log, edit, or delete another workspace's habit through the active workspace", async () => {
    const bobHabit = await newHabit(bob.client, bobWs);
    const log = await setHabitLogInWorkspace(
      alice.client,
      ws,
      bobHabit,
      today,
      { type: "value", value: 1 },
      today,
    );
    expect(log).toEqual({ ok: false, error: "This habit no longer exists." });
    expect(await updateHabitInWorkspace(alice.client, ws, bobHabit, { title: "x" })).toMatchObject({
      ok: false,
    });
    expect(await deleteHabitInWorkspace(alice.client, ws, bobHabit)).toMatchObject({ ok: false });
    const { data } = await adminClient().from("habits").select("title").eq("id", bobHabit).single();
    expect(data?.title).toBe("Read");
    expect(await logs(bobHabit)).toEqual([]);
  });

  it("deleting a habit deletes its history", async () => {
    const id = await newHabit();
    await setHabitLogInWorkspace(alice.client, ws, id, today, { type: "value", value: 1 }, today);
    expect(await deleteHabitInWorkspace(alice.client, ws, id)).toMatchObject({ ok: true });
    expect(await logs(id)).toEqual([]);
  });
});
