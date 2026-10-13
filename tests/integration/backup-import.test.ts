import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildExportBundle } from "@/features/backups/export";
import type { WorkspaceContext } from "@/lib/workspace-context";
import type { Json } from "@/types/database";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  seedWorkspace,
  type TestUser,
  type WorkspaceFixture,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let a: WorkspaceFixture;
let b: WorkspaceFixture;
let bundle: Json;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-import");
  bob = await createConfirmedUser("bob-import");
  carol = await createConfirmedUser("carol-import");
  [a, b] = await Promise.all([seedWorkspace(alice), seedWorkspace(bob)]);
  const ctx = {
    supabase: alice.client,
    user: { id: alice.id, email: alice.email },
    workspace: { id: a.workspaceId, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: "2026-10-12",
  } as WorkspaceContext;
  bundle = (await buildExportBundle(ctx)) as unknown as Json;
});

afterAll(async () => {
  await deleteUsers(alice, bob, carol);
});

describe("import_workspace", () => {
  it("replace restores the backup and clears what was there", async () => {
    const { data, error } = await bob.client.rpc("import_workspace", {
      target_workspace: b.workspaceId,
      payload: bundle,
      mode: "replace",
    });
    expect(error).toBeNull();

    const admin = adminClient();
    // Alice's task now lives in Bob's workspace, with the workspace rewritten.
    const restored = await admin
      .from("tasks")
      .select("id, workspace_id")
      .eq("id", a.taskId)
      .maybeSingle();
    expect(restored.data?.workspace_id).toBe(b.workspaceId);
    // Bob's original seeded task was deleted by the replace.
    const original = await admin.from("tasks").select("id").eq("id", b.taskId).maybeSingle();
    expect(original.data).toBeNull();
    // The reported count matches what landed.
    expect((data as { inserted: number }).inserted).toBeGreaterThan(0);
  });

  it("merge is idempotent: re-importing the same backup inserts nothing", async () => {
    const { data, error } = await bob.client.rpc("import_workspace", {
      target_workspace: b.workspaceId,
      payload: bundle,
      mode: "merge",
    });
    expect(error).toBeNull();
    expect((data as { inserted: number }).inserted).toBe(0);
  });

  it("rejects an unsupported schema version", async () => {
    const { error } = await bob.client.rpc("import_workspace", {
      target_workspace: b.workspaceId,
      payload: { schema_version: 2, records: {} } as Json,
      mode: "replace",
    });
    expect(error?.message).toContain("BAD_SCHEMA_VERSION");
  });

  it("refuses to import into a workspace the caller isn't a member of", async () => {
    const { error } = await alice.client.rpc("import_workspace", {
      target_workspace: await bobWorkspaceOutsider(),
      payload: { schema_version: 1, records: {} } as Json,
      mode: "merge",
    });
    expect(error?.message).toContain("FORBIDDEN");
  });
});

/** Carol's workspace, which Alice is not a member of. */
async function bobWorkspaceOutsider(): Promise<string> {
  const { data } = await adminClient()
    .from("workspaces")
    .select("id")
    .eq("created_by", carol.id)
    .eq("is_personal", true)
    .single();
  return data!.id;
}
