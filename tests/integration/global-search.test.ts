import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchWorkspace } from "@/features/search/queries";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { createConfirmedUser, deleteUsers, personalWorkspaceId, type TestUser } from "./helpers";

/*
 * Global search (REQUIREMENTS 9): finds matches across all six entity types in the caller's own
 * workspace, and never another user's records, even when the other workspace id is passed in.
 */

let alice: TestUser;
let bob: TestUser;
let aliceCtx: WorkspaceContext;
let bobWorkspace: string;

const contextFor = (user: TestUser, workspaceId: string): WorkspaceContext => ({
  supabase: user.client,
  user: { id: user.id, email: user.email },
  workspace: { id: workspaceId, name: "Personal", is_personal: true },
  timezone: "UTC",
  weekStart: 1,
  today: new Date().toISOString().slice(0, 10),
});

beforeAll(async () => {
  alice = await createConfirmedUser("search-a");
  bob = await createConfirmedUser("search-b");
  const aliceWs = await personalWorkspaceId(alice.id);
  bobWorkspace = await personalWorkspaceId(bob.id);
  aliceCtx = contextFor(alice, aliceWs);

  const ws = aliceWs;
  await alice.client
    .from("tasks")
    .insert({ workspace_id: ws, title: "Draft the marigold report" })
    .throwOnError();
  await alice.client
    .from("projects")
    .insert({ workspace_id: ws, name: "Garden", description: "Plant marigold borders" })
    .throwOnError();
  await alice.client
    .from("goals")
    .insert({ workspace_id: ws, title: "Marigold season" })
    .throwOnError();
  await alice.client
    .from("ideas")
    .insert({ workspace_id: ws, title: "Seeds", body: "Try marigold" })
    .throwOnError();
  await alice.client
    .from("notes")
    .insert({ workspace_id: ws, title: "Marigold care", body: "" })
    .throwOnError();
  await alice.client
    .from("journal_entries")
    .insert({
      workspace_id: ws,
      entry_date: "2026-11-05",
      title: null,
      body: "The marigold bloomed.",
    })
    .throwOnError();
  // Bob has a matching record that must never appear for Alice.
  await bob.client
    .from("tasks")
    .insert({ workspace_id: bobWorkspace, title: "Bob's marigold secret" })
    .throwOnError();
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

describe("searchWorkspace", () => {
  it("finds matches in titles and text across all six types", async () => {
    const result = await searchWorkspace(aliceCtx, "marigold");
    expect(result.groups.map((g) => g.type).sort()).toEqual(
      ["goal", "idea", "journal", "note", "project", "task"].sort(),
    );
    const project = result.groups.find((g) => g.type === "project")!.results[0]!;
    expect(project.snippet).toContain("marigold"); // matched in the description, not the name
    const journal = result.groups.find((g) => g.type === "journal")!.results[0]!;
    expect(journal.href).toMatch(/^\/journal\//);
  });

  it("never returns another user's records", async () => {
    const result = await searchWorkspace(aliceCtx, "secret");
    expect(result.groups).toEqual([]);
  });

  it("returns nothing when pointed at a workspace the caller is not a member of", async () => {
    const result = await searchWorkspace(contextFor(alice, bobWorkspace), "marigold");
    expect(result.groups).toEqual([]);
  });

  it("treats LIKE wildcards and filter syntax in the query literally", async () => {
    expect((await searchWorkspace(aliceCtx, "%")).groups).toEqual([]);
    expect((await searchWorkspace(aliceCtx, "a,title.ilike.*")).groups).toEqual([]);
  });
});
