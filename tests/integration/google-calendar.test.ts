import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { googleClient } from "@/features/google-calendar/client";
import { getGoogleConfig, type GoogleConfig } from "@/features/google-calendar/config";
import { loadConnectionRow, type GoogleDeps } from "@/features/google-calendar/connection";
import { encryptSecret, tokenContext } from "@/features/google-calendar/crypto";
import { eventIdForBlock } from "@/features/google-calendar/events";
import { loadGoogleEvents } from "@/features/google-calendar/queries";
import { syncConnection } from "@/features/google-calendar/sync";
import { FakeGoogle, fakeGoogleConfig } from "../support/fake-google";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  personalWorkspaceId,
  publicClient,
  type TestUser,
} from "./helpers";

const INSUFFICIENT_PRIVILEGE = "42501";

let alice: TestUser;
let bob: TestUser;
let aliceWs: string;
let bobWs: string;
let config: GoogleConfig;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-google");
  bob = await createConfirmedUser("bob-google");
  [aliceWs, bobWs] = await Promise.all([
    personalWorkspaceId(alice.id),
    personalWorkspaceId(bob.id),
  ]);
  const result = getGoogleConfig(fakeGoogleConfig());
  if (!result.enabled) throw new Error("fake config should be valid");
  config = result.config;
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

let fake: FakeGoogle;
let email: string;
let deps: GoogleDeps;

const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

/** Simulates a completed OAuth callback: encrypted tokens stored as Alice. */
async function connect(target?: string) {
  const account = fake.addAccount();
  email = account.email;
  const { refresh, access } = fake.issueTokens(email);
  const { error } = await alice.client.from("google_calendar_connections").insert({
    workspace_id: aliceWs,
    user_id: alice.id,
    google_account_email: email,
    refresh_token_ciphertext: encryptSecret(
      refresh,
      config.tokenKey,
      tokenContext(aliceWs, alice.id, "refresh"),
    ),
    access_token_ciphertext: encryptSecret(
      access,
      config.tokenKey,
      tokenContext(aliceWs, alice.id, "access"),
    ),
    access_token_expires_at: hours(1),
    scopes: [],
    target_calendar_id: target ?? email,
    target_calendar_name: "Primary",
    read_calendar_ids: [email],
  });
  if (error) throw error;
  return { refresh, access };
}

async function conn() {
  const row = await loadConnectionRow(deps);
  if (!row) throw new Error("no connection");
  return row;
}

async function addBlock(title: string, startH = 24, endH = 25) {
  const { data, error } = await alice.client
    .from("time_blocks")
    .insert({
      workspace_id: aliceWs,
      title,
      notes: "private note, never sent",
      starts_at: hours(startH),
      ends_at: hours(endH),
      timezone: "Asia/Tokyo",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeEach(async () => {
  const admin = adminClient();
  await admin.from("google_calendar_connections").delete().eq("workspace_id", aliceWs);
  await admin.from("time_blocks").delete().eq("workspace_id", aliceWs);
  fake = new FakeGoogle();
  deps = {
    db: alice.client,
    workspaceId: aliceWs,
    userId: alice.id,
    config,
    google: googleClient(config, fake.fetch),
  };
});

describe("connection isolation (RLS)", () => {
  it("lets only the owner see or change a connection and its sync rows", async () => {
    await connect();
    await addBlock("Writing");
    await syncConnection(deps, await conn());

    for (const table of ["google_calendar_connections", "time_block_sync"] as const) {
      const own = await alice.client.from(table).select("id").eq("workspace_id", aliceWs);
      expect(own.data?.length, table).toBeGreaterThan(0);
      const other = await bob.client.from(table).select("id").eq("workspace_id", aliceWs);
      expect(other.data, table).toEqual([]);
      const anon = await publicClient().from(table).select("id");
      expect(anon.error?.code ?? (anon.data?.length ? "visible" : "hidden"), table).not.toBe(
        "visible",
      );
      const update = await bob.client
        .from(table)
        .update({ last_error: "x" })
        .eq("workspace_id", aliceWs)
        .select("id");
      expect(update.data ?? [], table).toEqual([]);
      const del = await bob.client.from(table).delete().eq("workspace_id", aliceWs).select("id");
      expect(del.data ?? [], table).toEqual([]);
    }
    const still = await adminClient()
      .from("google_calendar_connections")
      .select("last_error")
      .eq("workspace_id", aliceWs)
      .single();
    expect(still.data?.last_error).toBeNull();
  });

  it("hides a connection from other members of the same workspace", async () => {
    await connect();
    const admin = adminClient();
    await admin
      .from("workspace_members")
      .insert({ workspace_id: aliceWs, user_id: bob.id, role: "member" })
      .throwOnError();
    try {
      const seen = await bob.client
        .from("google_calendar_connections")
        .select("id, refresh_token_ciphertext")
        .eq("workspace_id", aliceWs);
      expect(seen.data).toEqual([]);
      // Bob can't take over Alice's workspace connection or add one in her name.
      const asAlice = await bob.client.from("google_calendar_connections").insert({
        workspace_id: aliceWs,
        user_id: alice.id,
        refresh_token_ciphertext: "v1.x.y.z",
      });
      expect(asAlice.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    } finally {
      await admin
        .from("workspace_members")
        .delete()
        .eq("workspace_id", aliceWs)
        .eq("user_id", bob.id);
    }
  });

  it("refuses connections for workspaces the user can't write to", async () => {
    const intoBob = await alice.client.from("google_calendar_connections").insert({
      workspace_id: bobWs,
      user_id: alice.id,
      refresh_token_ciphertext: "v1.x.y.z",
    });
    expect(intoBob.error).not.toBeNull();

    const admin = adminClient();
    await admin
      .from("workspace_members")
      .insert({ workspace_id: bobWs, user_id: alice.id, role: "viewer" })
      .throwOnError();
    try {
      const asViewer = await alice.client.from("google_calendar_connections").insert({
        workspace_id: bobWs,
        user_id: alice.id,
        refresh_token_ciphertext: "v1.x.y.z",
      });
      expect(asViewer.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    } finally {
      await admin
        .from("workspace_members")
        .delete()
        .eq("workspace_id", bobWs)
        .eq("user_id", alice.id);
    }
  });

  it("never lets a connection move to another user or workspace", async () => {
    await connect();
    const moved = await alice.client
      .from("google_calendar_connections")
      .update({ user_id: bob.id } as never)
      .eq("workspace_id", aliceWs);
    expect(moved.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("stores only ciphertext", async () => {
    const { refresh, access } = await connect();
    const row = await adminClient()
      .from("google_calendar_connections")
      .select("*")
      .eq("workspace_id", aliceWs)
      .single();
    const stored = JSON.stringify(row.data);
    expect(stored).not.toContain(refresh);
    expect(stored).not.toContain(access);
  });
});

describe("one-way sync", () => {
  it("creates each block once; repeated syncs change nothing", async () => {
    await connect();
    const first = await addBlock("Writing");
    await addBlock("Reading", 26, 27);

    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 2, failed: 0 });
    const events = fake.liveEvents(email);
    expect(events.map((e) => e.summary).sort()).toEqual(["Reading", "Writing"]);
    expect(events.find((e) => e.summary === "Writing")?.id).toBe(eventIdForBlock(first));
    // Only title and time are sent.
    expect(JSON.stringify(events)).not.toContain("private note");

    const writes = fake.writeCount();
    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 0, remaining: 0 });
    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 0 });
    expect(fake.writeCount()).toBe(writes);
    const row = await conn();
    expect(row.last_synced_at).not.toBeNull();
    expect(row.last_error).toBeNull();
  });

  it("pushes edits and deletes, without new events", async () => {
    await connect();
    const id = await addBlock("Draft");
    await syncConnection(deps, await conn());

    const startsAt = hours(30);
    await alice.client
      .from("time_blocks")
      .update({ title: "Final", starts_at: startsAt, ends_at: hours(31) })
      .eq("id", id)
      .throwOnError();
    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 1 });
    const events = fake.liveEvents(email);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: eventIdForBlock(id), summary: "Final" });
    const start = events[0]!.start as { dateTime: string; timeZone: string };
    expect(Date.parse(start.dateTime)).toBe(Date.parse(startsAt));
    expect(start.timeZone).toBe("Asia/Tokyo");

    await alice.client.from("time_blocks").delete().eq("id", id).throwOnError();
    // The sync row survives the block (time_block_id is cleared) so the event can be removed.
    const orphan = await alice.client
      .from("time_block_sync")
      .select("time_block_id")
      .eq("workspace_id", aliceWs);
    expect(orphan.data).toEqual([{ time_block_id: null }]);
    expect(await syncConnection(deps, await conn())).toMatchObject({ deleted: 1 });
    expect(fake.liveEvents(email)).toHaveLength(0);
    const rows = await alice.client
      .from("time_block_sync")
      .select("id")
      .eq("workspace_id", aliceWs);
    expect(rows.data).toEqual([]);
  });

  it("recovers from a run interrupted after Google saved the event", async () => {
    await connect();
    const id = await addBlock("Interrupted");
    // Google has the event, but Yawm never recorded it (crash before the database write).
    fake.addEvent(email, email, {
      id: eventIdForBlock(id),
      summary: "Interrupted",
      start: { dateTime: hours(24) },
      end: { dateTime: hours(25) },
    });
    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 1, failed: 0 });
    expect(fake.events(email)).toHaveLength(1);

    // A row left "pending" before the push is also safe to retry.
    const second = await addBlock("Pending", 40, 41);
    await alice.client.from("time_block_sync").insert({
      workspace_id: aliceWs,
      connection_id: (await conn()).id,
      time_block_id: second,
      calendar_id: email,
      event_id: eventIdForBlock(second),
      status: "pending",
    });
    await syncConnection(deps, await conn());
    await syncConnection(deps, await conn());
    expect(fake.liveEvents(email)).toHaveLength(2);
  });

  it("does not duplicate when two syncs run at once", async () => {
    await connect();
    await addBlock("One");
    await addBlock("Two", 26, 27);
    const [c1, c2] = await Promise.all([conn(), conn()]);
    await Promise.all([syncConnection(deps, c1), syncConnection(deps, c2)]);
    expect(fake.events(email)).toHaveLength(2);
  });

  it("moves events when the target calendar changes", async () => {
    await connect();
    await addBlock("Moving");
    await syncConnection(deps, await conn());
    const work = fake.accounts.get(email)!.calendars.find((c) => c.summary === "Work")!.id;
    await alice.client
      .from("google_calendar_connections")
      .update({ target_calendar_id: work })
      .eq("workspace_id", aliceWs)
      .throwOnError();
    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 1 });
    expect(fake.liveEvents(email, email)).toHaveLength(0);
    expect(fake.liveEvents(email, work)).toHaveLength(1);
  });

  it("does not duplicate after disconnecting and reconnecting", async () => {
    await connect();
    await addBlock("Kept");
    await syncConnection(deps, await conn());
    const account = email;

    await alice.client.from("google_calendar_connections").delete().eq("workspace_id", aliceWs);
    const rows = await adminClient()
      .from("time_block_sync")
      .select("id")
      .eq("workspace_id", aliceWs);
    expect(rows.data).toEqual([]);

    // Reconnect the same Google account.
    const { refresh, access } = fake.issueTokens(account);
    await alice.client
      .from("google_calendar_connections")
      .insert({
        workspace_id: aliceWs,
        user_id: alice.id,
        refresh_token_ciphertext: encryptSecret(
          refresh,
          config.tokenKey,
          tokenContext(aliceWs, alice.id, "refresh"),
        ),
        access_token_ciphertext: encryptSecret(
          access,
          config.tokenKey,
          tokenContext(aliceWs, alice.id, "access"),
        ),
        access_token_expires_at: hours(1),
        target_calendar_id: account,
      })
      .throwOnError();
    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 1, failed: 0 });
    expect(fake.events(account)).toHaveLength(1);
  });
});

describe("failures degrade safely", () => {
  it("refreshes an expired access token and stores the new one encrypted", async () => {
    await connect();
    await addBlock("Refresh");
    const before = (await conn()).access_token_ciphertext;
    fake.expireAccessTokens();
    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 1 });
    const after = await conn();
    expect(after.access_token_ciphertext).not.toBe(before);
    expect(after.status).toBe("active");
  });

  it("stops and asks to reconnect when access is revoked; blocks stay", async () => {
    await connect();
    const id = await addBlock("Revoked");
    fake.revokeAll(email);
    const summary = await syncConnection(deps, await conn());
    expect(summary).toMatchObject({ stopped: "reconnect", pushed: 0 });
    const row = await conn();
    expect(row.status).toBe("reconnect_required");
    expect(row.access_token_ciphertext).toBeNull();
    expect(row.last_error).toMatch(/Reconnect/);

    const calls = fake.calls.length;
    expect(await syncConnection(deps, await conn())).toMatchObject({ stopped: "reconnect" });
    expect(fake.calls.length).toBe(calls);
    const block = await alice.client.from("time_blocks").select("id").eq("id", id).single();
    expect(block.data?.id).toBe(id);
  });

  it("asks to reconnect when tokens can't be decrypted (key changed)", async () => {
    await connect();
    await addBlock("Rotated");
    const other = getGoogleConfig({
      ...fakeGoogleConfig(),
      GOOGLE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    });
    if (!other.enabled) throw new Error("config");
    fake.expireAccessTokens();
    const rotated = { ...deps, config: other.config };
    const row = (await loadConnectionRow(rotated))!;
    await alice.client
      .from("google_calendar_connections")
      .update({ access_token_ciphertext: null })
      .eq("id", row.id);
    row.access_token_ciphertext = null;
    expect(await syncConnection(rotated, row)).toMatchObject({ stopped: "reconnect" });
    expect((await conn()).last_error).toMatch(/encryption key/);
  });

  it("backs off after a rate limit and resumes later", async () => {
    await connect();
    await addBlock("Limited");
    fake.failNext({
      method: "POST",
      pathIncludes: "/events",
      status: 403,
      reason: "rateLimitExceeded",
    });
    expect(await syncConnection(deps, await conn())).toMatchObject({
      stopped: "rate_limited",
      failed: 1,
    });
    const limited = await conn();
    expect(Date.parse(limited.retry_after!)).toBeGreaterThan(Date.now());

    // Automatic runs wait; a manual "Sync now" may try again.
    const calls = fake.calls.length;
    expect(await syncConnection(deps, limited)).toMatchObject({ stopped: "rate_limited" });
    expect(fake.calls.length).toBe(calls);
    expect(await syncConnection(deps, await conn(), { force: true })).toMatchObject({
      pushed: 1,
      stopped: null,
    });
    expect((await conn()).retry_after).toBeNull();
    expect(fake.liveEvents(email)).toHaveLength(1);
  });

  it("marks a block failed on an outage and retries it next time", async () => {
    await connect();
    const id = await addBlock("Outage");
    fake.failNext({ method: "POST", pathIncludes: "/events", status: 503 });
    expect(await syncConnection(deps, await conn())).toMatchObject({ failed: 1, stopped: null });
    const row = await alice.client
      .from("time_block_sync")
      .select("status, last_error")
      .eq("time_block_id", id)
      .single();
    expect(row.data?.status).toBe("error");
    expect((await conn()).last_error).toMatch(/couldn't be reached/);

    expect(await syncConnection(deps, await conn())).toMatchObject({ pushed: 1, failed: 0 });
    expect(fake.liveEvents(email)).toHaveLength(1);
    expect((await conn()).last_error).toBeNull();
  });

  it("stops on a calendar it may no longer write to", async () => {
    await connect("en.holidays#holiday@group.v.calendar.google.com");
    await addBlock("Forbidden");
    expect(await syncConnection(deps, await conn())).toMatchObject({ stopped: "forbidden" });
    expect((await conn()).status).toBe("error");
  });
});

describe("read-only Google events", () => {
  it("shows Google events in range, without Yawm's own copies", async () => {
    await connect();
    await addBlock("Ours");
    await syncConnection(deps, await conn());
    fake.addEvent(email, email, {
      id: "dentist1",
      summary: "Dentist",
      start: { dateTime: hours(28) },
      end: { dateTime: hours(29) },
    });
    const row = await conn();
    const overview = {
      state: { available: false } as never,
      blockStates: new Map(),
      deps,
      conn: row,
    };
    const result = await loadGoogleEvents(overview, { start: hours(0), end: hours(48) });
    expect(result.error).toBeNull();
    expect(result.events.map((e) => e.title)).toEqual(["Dentist"]);

    fake.failNext({ method: "GET", pathIncludes: "/events", status: 503 });
    const failed = await loadGoogleEvents(overview, { start: hours(0), end: hours(48) });
    expect(failed.events).toEqual([]);
    expect(failed.error).toMatch(/couldn't be loaded/);
  });
});
