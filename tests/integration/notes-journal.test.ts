import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createEntryInWorkspace,
  deleteEntryInWorkspace,
  updateEntryInWorkspace,
} from "@/features/journal/mutations";
import { loadJournalEntries, loadJournalMonths } from "@/features/journal/queries";
import {
  createNoteInWorkspace,
  deleteNoteInWorkspace,
  setNoteArchivedInWorkspace,
  updateNoteInWorkspace,
} from "@/features/notes/mutations";
import { loadNotes } from "@/features/notes/queries";
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
let ws: string;
let bobWs: string;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-nj");
  bob = await createConfirmedUser("bob-nj");
  [ws, bobWs] = await Promise.all([personalWorkspaceId(alice.id), personalWorkspaceId(bob.id)]);
  // Alice is also a member of Bob's workspace: proves that scoping to the *active* workspace, not
  // just RLS membership, blocks cross-workspace writes.
  await adminClient()
    .from("workspace_members")
    .insert({ workspace_id: bobWs, user_id: alice.id, role: "member" })
    .throwOnError();
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

const ctx = (db = alice.client, workspace = ws): WorkspaceContext =>
  ({
    supabase: db,
    user: { id: alice.id, email: alice.email },
    workspace: { id: workspace, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: "2026-10-12",
  }) as WorkspaceContext;

async function note(title = "A note", db = alice.client, workspace = ws) {
  const result = await createNoteInWorkspace(db, workspace, { title, body: null });
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

async function entry(entry_date = "2026-10-12", db = alice.client, workspace = ws) {
  const result = await createEntryInWorkspace(db, workspace, {
    entry_date,
    prompt: null,
    body: null,
  });
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

describe("notes", () => {
  it("saves content, links, and tags, then reads them back", async () => {
    const project = (
      await alice.client
        .from("projects")
        .insert({ workspace_id: ws, name: "P" })
        .select("id")
        .single()
    ).data!.id;
    const id = await note("Weekly thoughts");

    expect(
      await updateNoteInWorkspace(
        alice.client,
        ws,
        id,
        { title: "Weekly thoughts", body: "Things to remember", project_id: project },
        ["review", "ideas"],
      ),
    ).toEqual({ ok: true, data: undefined });

    const page = await loadNotes(ctx(), { q: null, tagId: null, archived: false });
    const saved = page.notes.find((n) => n.id === id)!;
    expect(saved.body).toBe("Things to remember");
    expect(saved.project_id).toBe(project);
    expect(saved.tags.map((t) => t.name)).toEqual(["ideas", "review"]);

    // Filter by one of its tags.
    const tagId = saved.tags.find((t) => t.name === "review")!.id;
    const filtered = await loadNotes(ctx(), { q: null, tagId, archived: false });
    expect(filtered.notes.some((n) => n.id === id)).toBe(true);

    // Search on the body.
    const searched = await loadNotes(ctx(), { q: "remember", tagId: null, archived: false });
    expect(searched.notes.some((n) => n.id === id)).toBe(true);
  });

  it("archives and restores, hiding archived notes from the active list", async () => {
    const id = await note("Archive me");
    expect(await setNoteArchivedInWorkspace(alice.client, ws, id, true)).toMatchObject({
      ok: true,
    });
    const active = await loadNotes(ctx(), { q: null, tagId: null, archived: false });
    expect(active.notes.some((n) => n.id === id)).toBe(false);
    const archived = await loadNotes(ctx(), { q: null, tagId: null, archived: true });
    expect(archived.notes.some((n) => n.id === id)).toBe(true);
    await setNoteArchivedInWorkspace(alice.client, ws, id, false);
    const restored = await loadNotes(ctx(), { q: null, tagId: null, archived: false });
    expect(restored.notes.some((n) => n.id === id)).toBe(true);
  });

  it("cannot be read, edited, or deleted across workspaces", async () => {
    const bobNote = await note("Bob's note", bob.client, bobWs);
    // Alice's own list never contains Bob's note.
    const page = await loadNotes(ctx(), { q: null, tagId: null, archived: false });
    expect(page.notes.some((n) => n.id === bobNote)).toBe(false);
    // The active-workspace functions refuse Bob's row even though Alice is a member of his ws.
    expect(await updateNoteInWorkspace(alice.client, ws, bobNote, { title: "hacked" }, [])).toEqual(
      { ok: false, error: "This note no longer exists." },
    );
    expect(await setNoteArchivedInWorkspace(alice.client, ws, bobNote, true)).toMatchObject({
      ok: false,
    });
    expect(await deleteNoteInWorkspace(alice.client, ws, bobNote)).toMatchObject({ ok: false });
    const stillThere = await adminClient().from("notes").select("title").eq("id", bobNote).single();
    expect(stillThere.data?.title).toBe("Bob's note");
  });

  it("refuses to link a note to another workspace's work", async () => {
    const id = await note("Linker");
    const bobProject = (
      await bob.client
        .from("projects")
        .insert({ workspace_id: bobWs, name: "BP" })
        .select("id")
        .single()
    ).data!.id;
    expect(
      await updateNoteInWorkspace(alice.client, ws, id, { project_id: bobProject }, []),
    ).toEqual({ ok: false, error: "Link only to work in this workspace." });
  });

  it("rejects anonymous and cross-workspace inserts at the RLS layer", async () => {
    const insert = await alice.client
      .from("notes")
      .insert({ workspace_id: bobWs, title: "x" } as never);
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    const tagRpc = await alice.client.rpc("set_note_tags", {
      target_note_id: await note("Bob tag target", bob.client, bobWs),
      tag_names: ["x"],
    });
    expect(tagRpc.error?.code).toBe("P0002");
  });
});

describe("journal", () => {
  it("saves fields and tags, groups by month, and filters", async () => {
    const id = await entry("2026-10-12");
    expect(
      await updateEntryInWorkspace(
        alice.client,
        ws,
        id,
        { title: "Good day", body: "Felt focused", mood: 4, energy: 3 },
        ["gratitude"],
      ),
    ).toEqual({ ok: true, data: undefined });

    const page = await loadJournalEntries(ctx(), { q: null, tagId: null, month: "2026-10" });
    const saved = page.entries.find((e) => e.id === id)!;
    expect(saved.title).toBe("Good day");
    expect(saved.mood).toBe(4);
    expect(saved.energy).toBe(3);
    expect(saved.tags.map((t) => t.name)).toEqual(["gratitude"]);

    // A different month excludes it.
    const other = await loadJournalEntries(ctx(), { q: null, tagId: null, month: "2026-09" });
    expect(other.entries.some((e) => e.id === id)).toBe(false);

    // Search on the body.
    const searched = await loadJournalEntries(ctx(), { q: "focused", tagId: null, month: null });
    expect(searched.entries.some((e) => e.id === id)).toBe(true);

    expect(await loadJournalMonths(ctx())).toContain("2026-10");
  });

  it("allows several entries on the same date", async () => {
    const a = await entry("2026-11-01");
    const b = await entry("2026-11-01");
    expect(a).not.toBe(b);
    const page = await loadJournalEntries(ctx(), { q: null, tagId: null, month: "2026-11" });
    expect(page.entries.filter((e) => e.entry_date === "2026-11-01").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("cannot be edited or deleted across workspaces", async () => {
    const bobEntry = await entry("2026-10-12", bob.client, bobWs);
    expect(
      await updateEntryInWorkspace(alice.client, ws, bobEntry, { title: "hacked" }, []),
    ).toEqual({ ok: false, error: "This journal entry no longer exists." });
    expect(await deleteEntryInWorkspace(alice.client, ws, bobEntry)).toMatchObject({ ok: false });
    const stillThere = await adminClient()
      .from("journal_entries")
      .select("id")
      .eq("id", bobEntry)
      .single();
    expect(stillThere.data?.id).toBe(bobEntry);
    // Alice's list never shows Bob's entry.
    const page = await loadJournalEntries(ctx(), { q: null, tagId: null, month: "2026-10" });
    expect(page.entries.some((e) => e.id === bobEntry)).toBe(false);
  });

  it("rejects cross-workspace inserts and tag writes at the RLS layer", async () => {
    const insert = await alice.client
      .from("journal_entries")
      .insert({ workspace_id: bobWs, entry_date: "2026-10-12" } as never);
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);
    const tagRpc = await alice.client.rpc("set_journal_tags", {
      target_entry_id: await entry("2026-10-12", bob.client, bobWs),
      tag_names: ["x"],
    });
    expect(tagRpc.error?.code).toBe("P0002");
  });

  it("deletes an entry and its tags", async () => {
    const id = await entry("2026-12-01");
    await updateEntryInWorkspace(alice.client, ws, id, { title: "Temp" }, ["temp"]);
    expect(await deleteEntryInWorkspace(alice.client, ws, id)).toMatchObject({ ok: true });
    const gone = await adminClient().from("journal_entries").select("id").eq("id", id);
    expect(gone.data).toEqual([]);
    const tagLinks = await adminClient()
      .from("journal_entry_tags")
      .select("tag_id")
      .eq("entry_id", id);
    expect(tagLinks.data).toEqual([]);
  });
});
