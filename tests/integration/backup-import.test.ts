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

// Import preserves record ids (so references resolve), and ids are global primary keys. The
// supported case is restoring your OWN backup into your OWN workspace: replace frees the ids first,
// then re-inserts them. (Importing someone else's backup while their rows still exist elsewhere
// would hit the primary key and be skipped — a documented limitation.)

let alice: TestUser;
let carol: TestUser;
let a: WorkspaceFixture;
let bundle: Json;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-import");
  carol = await createConfirmedUser("carol-import");
  a = await seedWorkspace(alice);
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
  await deleteUsers(alice, carol);
});

describe("import_workspace", () => {
  it("replace restores the backup and clears records not in it", async () => {
    // A task created after the export; a replace restore should remove it.
    const extra = (
      await alice.client
        .from("tasks")
        .insert({ workspace_id: a.workspaceId, title: "Created after export" })
        .select("id")
        .single()
    ).data!.id;

    const { data, error } = await alice.client.rpc("import_workspace", {
      target_workspace: a.workspaceId,
      payload: bundle,
      mode: "replace",
    });
    expect(error).toBeNull();
    expect((data as { inserted: number }).inserted).toBeGreaterThan(0);

    const admin = adminClient();
    const restored = await admin.from("tasks").select("id").eq("id", a.taskId).maybeSingle();
    expect(restored.data?.id).toBe(a.taskId);
    const gone = await admin.from("tasks").select("id").eq("id", extra).maybeSingle();
    expect(gone.data).toBeNull();
  });

  it("merge is idempotent: re-importing the same backup inserts nothing", async () => {
    const { data, error } = await alice.client.rpc("import_workspace", {
      target_workspace: a.workspaceId,
      payload: bundle,
      mode: "merge",
    });
    expect(error).toBeNull();
    expect((data as { inserted: number }).inserted).toBe(0);
  });

  it("rejects an unsupported schema version", async () => {
    const { error } = await alice.client.rpc("import_workspace", {
      target_workspace: a.workspaceId,
      payload: { schema_version: 2, records: {} } as Json,
      mode: "replace",
    });
    expect(error?.message).toContain("BAD_SCHEMA_VERSION");
  });

  it("refuses to import into a workspace the caller isn't a member of", async () => {
    const { data: carolWs } = await adminClient()
      .from("workspaces")
      .select("id")
      .eq("created_by", carol.id)
      .eq("is_personal", true)
      .single();
    const { error } = await alice.client.rpc("import_workspace", {
      target_workspace: carolWs!.id,
      payload: { schema_version: 1, records: {} } as Json,
      mode: "merge",
    });
    expect(error?.message).toContain("FORBIDDEN");
  });
});
