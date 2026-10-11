import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  personalWorkspaceId,
  publicClient,
  type TestUser,
} from "./helpers";

// PostgREST surfaces missing table/column privileges and RLS WITH CHECK failures as 42501.
const INSUFFICIENT_PRIVILEGE = "42501";

let alice: TestUser;
let bob: TestUser;
let aliceWorkspace: string;
let bobWorkspace: string;
let bobAreaId: string;

beforeAll(async () => {
  alice = await createConfirmedUser("alice", {
    timezone: "Europe/London",
    display_name: "Alice",
  });
  bob = await createConfirmedUser("bob", { timezone: "Asia/Tokyo" });
  aliceWorkspace = await personalWorkspaceId(alice.id);
  bobWorkspace = await personalWorkspaceId(bob.id);

  const { data, error } = await adminClient()
    .from("areas")
    .select("id")
    .eq("workspace_id", bobWorkspace)
    .eq("name", "Physical")
    .single();
  if (error) throw error;
  bobAreaId = data.id;
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

describe("account bootstrap", () => {
  it("creates a profile using the signup timezone and display name", async () => {
    const { data, error } = await alice.client.from("profiles").select("*").single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: alice.id,
      display_name: "Alice",
      timezone: "Europe/London",
      week_start: 1,
    });
  });

  it("creates exactly one private personal workspace with the user as owner", async () => {
    const workspaces = await alice.client.from("workspaces").select("id, name, is_personal");
    expect(workspaces.error).toBeNull();
    expect(workspaces.data).toEqual([{ id: aliceWorkspace, name: "Personal", is_personal: true }]);

    const members = await alice.client.from("workspace_members").select("user_id, role");
    expect(members.error).toBeNull();
    expect(members.data).toEqual([{ user_id: alice.id, role: "owner" }]);
  });

  it("creates the four default life areas in order", async () => {
    const { data, error } = await alice.client
      .from("areas")
      .select("name, workspace_id")
      .order("sort_order");
    expect(error).toBeNull();
    expect(data?.map((a) => a.name)).toEqual(["Spiritual", "Mental", "Physical", "Finances"]);
    expect(new Set(data?.map((a) => a.workspace_id))).toEqual(new Set([aliceWorkspace]));
  });

  it("falls back to UTC when the signup timezone is not a valid IANA name", async () => {
    const user = await createConfirmedUser("tz", { timezone: "Mars/Olympus_Mons" });
    try {
      const { data } = await user.client.from("profiles").select("timezone").single();
      expect(data?.timezone).toBe("UTC");
    } finally {
      await deleteUsers(user);
    }
  });
});

describe("cross-user reads", () => {
  it("hides another user's profile", async () => {
    const { data, error } = await alice.client.from("profiles").select("id").eq("id", bob.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("hides another user's workspace, memberships, and areas", async () => {
    const workspace = await alice.client.from("workspaces").select("id").eq("id", bobWorkspace);
    const members = await alice.client
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", bobWorkspace);
    const areas = await alice.client.from("areas").select("id").eq("workspace_id", bobWorkspace);

    expect(workspace).toMatchObject({ error: null, data: [] });
    expect(members).toMatchObject({ error: null, data: [] });
    expect(areas).toMatchObject({ error: null, data: [] });
  });

  it("returns only the caller's rows from unfiltered queries", async () => {
    const { data } = await alice.client.from("areas").select("workspace_id");
    expect(data).toHaveLength(4);
    expect(data?.every((a) => a.workspace_id === aliceWorkspace)).toBe(true);
  });

  it("gives anonymous callers no access", async () => {
    const anon = publicClient();
    for (const table of ["profiles", "workspaces", "workspace_members", "areas"] as const) {
      const { data, error } = await anon.from(table).select("*");
      // Either outcome means no rows were exposed.
      expect(error?.code === INSUFFICIENT_PRIVILEGE || data?.length === 0).toBe(true);
    }
  });
});

describe("cross-user writes", () => {
  it("rejects inserting an area into another user's workspace", async () => {
    const { error } = await alice.client
      .from("areas")
      .insert({ workspace_id: bobWorkspace, name: "Intruder" });
    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("cannot update or delete another user's area", async () => {
    const update = await alice.client
      .from("areas")
      .update({ name: "Hacked" })
      .eq("id", bobAreaId)
      .select();
    expect(update).toMatchObject({ error: null, data: [] });

    const remove = await alice.client.from("areas").delete().eq("id", bobAreaId).select();
    expect(remove).toMatchObject({ error: null, data: [] });

    const { data } = await adminClient().from("areas").select("name").eq("id", bobAreaId).single();
    expect(data?.name).toBe("Physical");
  });

  it("cannot rename another user's workspace or edit their profile", async () => {
    const workspace = await alice.client
      .from("workspaces")
      .update({ name: "Mine now" })
      .eq("id", bobWorkspace)
      .select();
    expect(workspace).toMatchObject({ error: null, data: [] });

    const profile = await alice.client
      .from("profiles")
      .update({ display_name: "Hacked" })
      .eq("id", bob.id)
      .select();
    expect(profile).toMatchObject({ error: null, data: [] });

    const admin = adminClient();
    const ws = await admin.from("workspaces").select("name").eq("id", bobWorkspace).single();
    const pr = await admin.from("profiles").select("display_name").eq("id", bob.id).single();
    expect(ws.data?.name).toBe("Personal");
    expect(pr.data?.display_name).toBeNull();
  });

  it("cannot add itself as a member of another user's workspace", async () => {
    const { error } = await alice.client
      .from("workspace_members")
      .insert({ workspace_id: bobWorkspace, user_id: alice.id, role: "owner" });
    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("cannot move its own area into another workspace", async () => {
    const { data: own } = await alice.client.from("areas").select("id").limit(1).single();
    const { error } = await alice.client
      .from("areas")
      .update({ workspace_id: bobWorkspace })
      .eq("id", own!.id);
    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("cannot change its own membership role or create workspaces directly", async () => {
    const role = await alice.client
      .from("workspace_members")
      .update({ role: "viewer" })
      .eq("workspace_id", aliceWorkspace);
    expect(role.error?.code).toBe(INSUFFICIENT_PRIVILEGE);

    const workspace = await alice.client
      .from("workspaces")
      .insert({ name: "Side", created_by: alice.id });
    expect(workspace.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe("own-workspace writes", () => {
  it("can create, rename, archive, and delete its own areas", async () => {
    const name = `Learning ${randomUUID().slice(0, 8)}`;
    const created = await alice.client
      .from("areas")
      .insert({ workspace_id: aliceWorkspace, name, color: "#123abc", sort_order: 9 })
      .select()
      .single();
    expect(created.error).toBeNull();
    const id = created.data!.id;

    const renamed = await alice.client
      .from("areas")
      .update({ name: `${name}!`, archived_at: new Date().toISOString() })
      .eq("id", id)
      .select("name, archived_at")
      .single();
    expect(renamed.error).toBeNull();
    expect(renamed.data?.archived_at).not.toBeNull();

    const removed = await alice.client.from("areas").delete().eq("id", id).select("id");
    expect(removed.data).toEqual([{ id }]);
  });

  it("validates profile timezone and week start in the database", async () => {
    const tz = await alice.client
      .from("profiles")
      .update({ timezone: "Not/A_Zone" })
      .eq("id", alice.id);
    expect(tz.error?.code).toBe("23514");

    const week = await alice.client.from("profiles").update({ week_start: 7 }).eq("id", alice.id);
    expect(week.error?.code).toBe("23514");

    const ok = await alice.client
      .from("profiles")
      .update({ timezone: "America/New_York", week_start: 0 })
      .eq("id", alice.id)
      .select("timezone, week_start")
      .single();
    expect(ok.data).toEqual({ timezone: "America/New_York", week_start: 0 });
  });
});

describe("viewer role", () => {
  let viewer: TestUser;
  let aliceAreaId: string;

  beforeAll(async () => {
    viewer = await createConfirmedUser("viewer");
    const admin = adminClient();
    const { error } = await admin
      .from("workspace_members")
      .insert({ workspace_id: aliceWorkspace, user_id: viewer.id, role: "viewer" });
    if (error) throw error;
    const { data } = await admin
      .from("areas")
      .select("id")
      .eq("workspace_id", aliceWorkspace)
      .eq("name", "Mental")
      .single();
    aliceAreaId = data!.id;
  });

  afterAll(async () => {
    await deleteUsers(viewer);
  });

  it("can read the shared workspace's areas", async () => {
    const { data } = await viewer.client
      .from("areas")
      .select("id")
      .eq("workspace_id", aliceWorkspace);
    expect(data).toHaveLength(4);
  });

  it("cannot write to the shared workspace", async () => {
    const insert = await viewer.client
      .from("areas")
      .insert({ workspace_id: aliceWorkspace, name: "Viewer area" });
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);

    const update = await viewer.client
      .from("areas")
      .update({ name: "Changed" })
      .eq("id", aliceAreaId)
      .select();
    expect(update).toMatchObject({ error: null, data: [] });

    const rename = await viewer.client
      .from("workspaces")
      .update({ name: "Changed" })
      .eq("id", aliceWorkspace)
      .select();
    expect(rename).toMatchObject({ error: null, data: [] });
  });

  it("cannot promote itself", async () => {
    const { error } = await viewer.client
      .from("workspace_members")
      .update({ role: "owner" })
      .eq("user_id", viewer.id);
    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe("email verification", () => {
  it("does not allow sign-in before the email is confirmed", async () => {
    const client = publicClient();
    const email = `unconfirmed-${randomUUID()}@example.test`;
    const password = `pw-${randomUUID()}`;
    const signUp = await client.auth.signUp({ email, password });
    expect(signUp.error).toBeNull();
    expect(signUp.data.session).toBeNull();

    try {
      const signIn = await client.auth.signInWithPassword({ email, password });
      expect(signIn.error?.code).toBe("email_not_confirmed");
      expect(signIn.data.session).toBeNull();
    } finally {
      if (signUp.data.user) await adminClient().auth.admin.deleteUser(signUp.data.user.id);
    }
  });
});
