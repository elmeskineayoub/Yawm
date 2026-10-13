import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildExportBundle, EXPORT_SCHEMA_VERSION } from "@/features/backups/export";
import type { WorkspaceContext } from "@/lib/workspace-context";
import {
  createConfirmedUser,
  deleteUsers,
  seedWorkspace,
  type TestUser,
  type WorkspaceFixture,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let a: WorkspaceFixture;
let b: WorkspaceFixture;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-export");
  bob = await createConfirmedUser("bob-export");
  [a, b] = await Promise.all([seedWorkspace(alice), seedWorkspace(bob)]);
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

const ctx = (): WorkspaceContext =>
  ({
    supabase: alice.client,
    user: { id: alice.id, email: alice.email },
    workspace: { id: a.workspaceId, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: "2026-10-12",
  }) as WorkspaceContext;

describe("buildExportBundle", () => {
  it("exports only the caller's workspace, with a schema version and profile", async () => {
    const bundle = await buildExportBundle(ctx());

    expect(bundle.schema_version).toBe(EXPORT_SCHEMA_VERSION);
    expect(bundle.app).toBe("Yawm");
    expect(bundle.workspace.id).toBe(a.workspaceId);
    expect(bundle.profile).not.toBeNull();
    expect(bundle.profile?.timezone).toBeTypeOf("string");

    // The seeded tasks are present.
    const taskIds = bundle.records.tasks.map((t) => t.id);
    expect(taskIds).toContain(a.taskId);
    expect(bundle.records.projects.map((p) => p.id)).toContain(a.projectId);
    expect(bundle.records.ideas.map((i) => i.id)).toContain(a.ideaId);
    expect(bundle.records.plan_items.length).toBeGreaterThan(0);
  });

  it("never includes another workspace's rows", async () => {
    const bundle = await buildExportBundle(ctx());
    for (const table of Object.values(bundle.records)) {
      for (const row of table as { workspace_id?: string }[]) {
        if ("workspace_id" in row) expect(row.workspace_id).toBe(a.workspaceId);
      }
    }
    expect(bundle.records.tasks.map((t) => t.id)).not.toContain(b.taskId);
  });

  it("excludes secret and transient tables", async () => {
    const bundle = await buildExportBundle(ctx());
    const keys = Object.keys(bundle.records);
    expect(keys).not.toContain("google_calendar_connections");
    expect(keys).not.toContain("time_block_sync");
    expect(keys).not.toContain("reminder_dismissals");
    // Spot-check that real content tables are present.
    expect(keys).toContain("journal_entries");
    expect(keys).toContain("weekly_reviews");
  });
});
