import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logFocusSessionInWorkspace } from "@/features/focus/mutations";
import { loadProjectFocusTotals } from "@/features/focus/queries";
import type { FocusSessionInput } from "@/features/focus/schemas";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { createConfirmedUser, deleteUsers, personalWorkspaceId, type TestUser } from "./helpers";

/*
 * Focus time per project (migration 20261107090000): a session can count toward a project in its
 * own workspace only; task and project stay consistent; each session counts once; totals are
 * isolated per workspace.
 */

let alice: TestUser;
let bob: TestUser;
let ws: string;
let bobWs: string;
let project: string;
let otherProject: string;
let bobProject: string;
let taskInProject: string;

const ctx = (): WorkspaceContext =>
  ({
    supabase: alice.client,
    user: { id: alice.id, email: alice.email },
    workspace: { id: ws, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: new Date().toISOString().slice(0, 10),
  }) as WorkspaceContext;

const session = (over: Partial<FocusSessionInput> = {}): FocusSessionInput => {
  const start = new Date(Date.now() - 30 * 60_000);
  return {
    id: randomUUID(),
    task_id: null,
    project_id: null,
    session_type: "focus",
    started_at: start.toISOString(),
    ended_at: new Date(start.getTime() + 12 * 60_000).toISOString(),
    duration_seconds: 12 * 60,
    ...over,
  };
};

beforeAll(async () => {
  alice = await createConfirmedUser("focus-proj-a");
  bob = await createConfirmedUser("focus-proj-b");
  [ws, bobWs] = await Promise.all([personalWorkspaceId(alice.id), personalWorkspaceId(bob.id)]);
  const make = async (user: TestUser, workspace: string, name: string) =>
    (
      await user.client
        .from("projects")
        .insert({ workspace_id: workspace, name })
        .select("id")
        .single()
        .throwOnError()
    ).data!.id;
  project = await make(alice, ws, "Newsletter");
  otherProject = await make(alice, ws, "Garden");
  bobProject = await make(bob, bobWs, "Bob's project");
  taskInProject = (
    await alice.client
      .from("tasks")
      .insert({ workspace_id: ws, title: "Write issue", project_id: project })
      .select("id")
      .single()
      .throwOnError()
  ).data!.id;
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

describe("focus sessions with a project", () => {
  it("saves a project-only session (no task) with its actual duration", async () => {
    const s = session({ project_id: project });
    expect(await logFocusSessionInWorkspace(alice.client, ws, s)).toMatchObject({
      ok: true,
      data: { projectSaved: true },
    });
    const { data } = await alice.client
      .from("focus_sessions")
      .select("project_id, duration_seconds")
      .eq("id", s.id)
      .single();
    expect(data).toEqual({ project_id: project, duration_seconds: 720 });
  });

  it("rejects a project from another workspace", async () => {
    const result = await logFocusSessionInWorkspace(
      alice.client,
      ws,
      session({ project_id: bobProject }),
    );
    expect(result.ok).toBe(false);
  });

  it("fills the project in from the task, and rejects a task from a different project", async () => {
    const s = session({ task_id: taskInProject });
    await logFocusSessionInWorkspace(alice.client, ws, s);
    const { data } = await alice.client
      .from("focus_sessions")
      .select("project_id")
      .eq("id", s.id)
      .single();
    expect(data?.project_id).toBe(project);

    const mismatch = await logFocusSessionInWorkspace(
      alice.client,
      ws,
      session({ task_id: taskInProject, project_id: otherProject }),
    );
    expect(mismatch).toMatchObject({
      ok: false,
      error: "That task belongs to a different project.",
    });
  });

  it("counts a session once even if it is saved twice", async () => {
    const before =
      (await loadProjectFocusTotals(ctx(), [otherProject])).totals[otherProject]?.totalSeconds ?? 0;
    const s = session({ project_id: otherProject });
    await logFocusSessionInWorkspace(alice.client, ws, s);
    await logFocusSessionInWorkspace(alice.client, ws, s);
    const after = (await loadProjectFocusTotals(ctx(), [otherProject])).totals[otherProject]!
      .totalSeconds;
    expect(after - before).toBe(720);
  });

  it("totals only the caller's workspace", async () => {
    await logFocusSessionInWorkspace(bob.client, bobWs, session({ project_id: bobProject }));
    const totals = await loadProjectFocusTotals(ctx());
    expect(totals.available).toBe(true);
    expect(Object.keys(totals.totals)).not.toContain(bobProject);
    expect(totals.totals[project]!.todaySeconds).toBeGreaterThan(0);
  });

  it("keeps the time when the project is deleted (the link is cleared)", async () => {
    const temp = (
      await alice.client
        .from("projects")
        .insert({ workspace_id: ws, name: "Temp" })
        .select("id")
        .single()
        .throwOnError()
    ).data!.id;
    const s = session({ project_id: temp });
    await logFocusSessionInWorkspace(alice.client, ws, s);
    await alice.client.from("projects").delete().eq("id", temp).throwOnError();
    const { data } = await alice.client
      .from("focus_sessions")
      .select("project_id, duration_seconds")
      .eq("id", s.id)
      .single();
    expect(data).toEqual({ project_id: null, duration_seconds: 720 });
  });
});
