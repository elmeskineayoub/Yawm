import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteFocusSessionInWorkspace,
  logFocusSessionInWorkspace,
} from "@/features/focus/mutations";
import { loadFocusSummary } from "@/features/focus/queries";
import type { FocusSessionInput } from "@/features/focus/schemas";
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
let bob: TestUser;
let carol: TestUser;
let ws: string;
let bobWs: string;
let carolWs: string;
let aliceTask: string;
let bobTask: string;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-focus");
  bob = await createConfirmedUser("bob-focus");
  carol = await createConfirmedUser("carol-focus");
  [ws, bobWs, carolWs] = await Promise.all([
    personalWorkspaceId(alice.id),
    personalWorkspaceId(bob.id),
    personalWorkspaceId(carol.id),
  ]);
  await adminClient()
    .from("workspace_members")
    .insert({ workspace_id: bobWs, user_id: alice.id, role: "member" })
    .throwOnError();
  aliceTask = (
    await alice.client
      .from("tasks")
      .insert({ workspace_id: ws, title: "Deep work" })
      .select("id")
      .single()
  ).data!.id;
  bobTask = (
    await bob.client
      .from("tasks")
      .insert({ workspace_id: bobWs, title: "Bob task" })
      .select("id")
      .single()
  ).data!.id;
});

afterAll(async () => {
  await deleteUsers(alice, bob, carol);
});

const ctx = (): WorkspaceContext =>
  ({
    supabase: alice.client,
    user: { id: alice.id, email: alice.email },
    workspace: { id: ws, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: "2026-10-12",
  }) as WorkspaceContext;

const session = (over: Partial<FocusSessionInput> = {}): FocusSessionInput => ({
  id: randomUUID(),
  task_id: null,
  session_type: "focus",
  started_at: "2026-10-12T09:00:00Z",
  ended_at: "2026-10-12T09:25:00Z",
  duration_seconds: 1500,
  ...over,
});

describe("logging focus sessions", () => {
  it("records a session and reports it in today's and this week's totals", async () => {
    const s = session();
    expect(await logFocusSessionInWorkspace(alice.client, ws, s)).toMatchObject({ ok: true });
    const summary = await loadFocusSummary(ctx());
    expect(summary.todaySeconds).toBe(1500);
    expect(summary.todayCount).toBe(1);
    expect(summary.weekSeconds).toBeGreaterThanOrEqual(1500);
    expect(summary.recent.some((r) => r.id === s.id)).toBe(true);
  });

  it("is idempotent: the same id logged twice does not duplicate", async () => {
    const s = session();
    await logFocusSessionInWorkspace(alice.client, ws, s);
    expect(await logFocusSessionInWorkspace(alice.client, ws, s)).toMatchObject({ ok: true });
    const { count } = await adminClient()
      .from("focus_sessions")
      .select("id", { count: "exact", head: true })
      .eq("id", s.id);
    expect(count).toBe(1);
  });

  it("counts focus time only, not breaks", async () => {
    const fresh = await loadFocusSummary(ctx());
    await logFocusSessionInWorkspace(
      alice.client,
      ws,
      session({ session_type: "short_break", duration_seconds: 300 }),
    );
    const after = await loadFocusSummary(ctx());
    expect(after.todaySeconds).toBe(fresh.todaySeconds); // break excluded
    expect(after.recent.some((r) => r.session_type === "short_break")).toBe(true);
  });

  it("links to a task in the same workspace and shows its title", async () => {
    const s = session({ task_id: aliceTask });
    await logFocusSessionInWorkspace(alice.client, ws, s);
    const summary = await loadFocusSummary(ctx());
    expect(summary.recent.find((r) => r.id === s.id)?.task?.title).toBe("Deep work");
  });

  it("refuses a task from another workspace", async () => {
    expect(
      await logFocusSessionInWorkspace(alice.client, ws, session({ task_id: bobTask })),
    ).toEqual({ ok: false, error: "That task is not in this workspace." });
  });
});

describe("isolation", () => {
  it("rejects an insert into a non-member workspace at the RLS layer", async () => {
    const insert = await alice.client.from("focus_sessions").insert({
      workspace_id: carolWs,
      session_type: "focus",
      started_at: "2026-10-12T09:00:00Z",
      ended_at: "2026-10-12T09:25:00Z",
      duration_seconds: 1500,
    } as never);
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("cannot delete another workspace's session via the active workspace", async () => {
    const bobSession = session();
    await logFocusSessionInWorkspace(bob.client, bobWs, bobSession);
    expect(await deleteFocusSessionInWorkspace(alice.client, ws, bobSession.id)).toEqual({
      ok: false,
      error: "This session no longer exists.",
    });
    const stillThere = await adminClient()
      .from("focus_sessions")
      .select("id")
      .eq("id", bobSession.id);
    expect(stillThere.data).toHaveLength(1);
  });

  it("deletes a session in its own workspace", async () => {
    const s = session();
    await logFocusSessionInWorkspace(alice.client, ws, s);
    expect(await deleteFocusSessionInWorkspace(alice.client, ws, s.id)).toMatchObject({ ok: true });
    const gone = await adminClient().from("focus_sessions").select("id").eq("id", s.id);
    expect(gone.data).toEqual([]);
  });
});
