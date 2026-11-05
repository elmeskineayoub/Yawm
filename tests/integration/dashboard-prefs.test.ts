import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createConfirmedUser, deleteUsers, type TestUser } from "./helpers";

/*
 * profiles.dashboard_prefs (migration 20261106090000): a user can store their own Dashboard layout
 * and no one else's; the value must be a small JSON object; the new column grant does not open up
 * other profile columns.
 */

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createConfirmedUser("dash-a");
  bob = await createConfirmedUser("dash-b");
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

describe("profiles.dashboard_prefs", () => {
  it("defaults to an empty object and lets a user save their own", async () => {
    const before = await alice.client
      .from("profiles")
      .select("dashboard_prefs")
      .eq("id", alice.id)
      .single();
    expect(before.data?.dashboard_prefs).toEqual({});
    const { data, error } = await alice.client
      .from("profiles")
      .update({ dashboard_prefs: { hidden: ["week"] } })
      .eq("id", alice.id)
      .select("dashboard_prefs");
    expect(error).toBeNull();
    expect(data?.[0]?.dashboard_prefs).toEqual({ hidden: ["week"] });
  });

  it("cannot change another user's layout", async () => {
    const { data } = await alice.client
      .from("profiles")
      .update({ dashboard_prefs: { hidden: ["attention"] } })
      .eq("id", bob.id)
      .select("id");
    expect(data ?? []).toHaveLength(0);
    const bobs = await bob.client
      .from("profiles")
      .select("dashboard_prefs")
      .eq("id", bob.id)
      .single();
    expect(bobs.data?.dashboard_prefs).toEqual({});
  });

  it("rejects values that are not a small JSON object", async () => {
    const array = await alice.client
      .from("profiles")
      .update({ dashboard_prefs: ["week"] })
      .eq("id", alice.id);
    expect(array.error).not.toBeNull();
    const huge = await alice.client
      .from("profiles")
      .update({ dashboard_prefs: { hidden: [], padding: "x".repeat(5000) } })
      .eq("id", alice.id);
    expect(huge.error).not.toBeNull();
  });

  it("does not widen the grant to other protected columns", async () => {
    const { error } = await alice.client
      .from("profiles")
      .update({ created_at: new Date(0).toISOString() } as never)
      .eq("id", alice.id);
    expect(error).not.toBeNull();
  });
});
