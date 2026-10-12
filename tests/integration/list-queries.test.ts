import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadIdeas } from "@/features/inbox/queries";
import { parseTaskFilters } from "@/features/tasks/filters";
import { loadFilteredTasks, loadLookups } from "@/features/tasks/queries";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { createConfirmedUser, deleteUsers, personalWorkspaceId, type TestUser } from "./helpers";

/*
 * Regression tests for list queries: filters must run in the database before any limit, so a
 * small display limit can be used to reproduce what happens with thousands of rows.
 */

let user: TestUser;
let ctx: WorkspaceContext;

beforeAll(async () => {
  user = await createConfirmedUser("lists");
  const workspaceId = await personalWorkspaceId(user.id);
  ctx = {
    supabase: user.client,
    user: { id: user.id, email: user.email },
    workspace: { id: workspaceId, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: new Date().toISOString().slice(0, 10),
  };
});

afterAll(async () => {
  await deleteUsers(user);
});

async function insertTask(title: string, fields: { status?: "done" } = {}) {
  const { data, error } = await user.client
    .from("tasks")
    .insert({ workspace_id: ctx.workspace.id, title, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("task tag filter", () => {
  let tagId: string;

  beforeAll(async () => {
    // Two old tagged tasks (one done), then six newer untagged ones.
    const taggedOpen = await insertTask("Tagged open");
    const taggedDone = await insertTask("Tagged done", { status: "done" });
    for (let i = 0; i < 6; i += 1) await insertTask(`Untagged ${i}`);
    for (const id of [taggedOpen, taggedDone]) {
      await user.client
        .rpc("set_task_tags", { target_task_id: id, tag_names: ["rare"] })
        .throwOnError();
    }
    const { data } = await user.client.from("tags").select("id").eq("name", "rare").single();
    tagId = data!.id;
  });

  it("finds older tagged tasks that fall outside the newest-N window", async () => {
    const lookups = await loadLookups(ctx);
    const result = await loadFilteredTasks(
      ctx,
      parseTaskFilters({ tag: tagId, status: "all" }),
      lookups,
      { limit: 5 },
    );
    expect(result.tasks.map((t) => t.title).sort()).toEqual(["Tagged done", "Tagged open"]);
    expect(result).toMatchObject({ total: 2, truncated: false });
  });

  it("combines the tag with other filters in the database", async () => {
    const lookups = await loadLookups(ctx);
    const result = await loadFilteredTasks(ctx, parseTaskFilters({ tag: tagId }), lookups, {
      limit: 5,
    });
    expect(result.tasks.map((t) => t.title)).toEqual(["Tagged open"]);
    expect(result).toMatchObject({ total: 1, truncated: false });
  });

  it("reports the true number of matches when the limit truncates", async () => {
    const lookups = await loadLookups(ctx);
    const result = await loadFilteredTasks(ctx, parseTaskFilters({}), lookups, { limit: 5 });
    expect(result.tasks).toHaveLength(5);
    // 7 open top-level tasks match: "Tagged open" and six untagged ones.
    expect(result).toMatchObject({ total: 7, truncated: true });
    // The newest are returned.
    expect(result.tasks.map((t) => t.title)).not.toContain("Tagged open");
  });

  it("keeps each task's full tag list while filtering on one tag", async () => {
    const { data: other } = await user.client
      .from("tasks")
      .select("id")
      .eq("title", "Tagged open")
      .single();
    await user.client
      .rpc("set_task_tags", { target_task_id: other!.id, tag_names: ["rare", "second"] })
      .throwOnError();
    const lookups = await loadLookups(ctx);
    const result = await loadFilteredTasks(ctx, parseTaskFilters({ tag: tagId }), lookups);
    expect(result.tasks[0]?.tags.map((t) => t.name).sort()).toEqual(["rare", "second"]);
  });
});

describe("inbox pagination", () => {
  let tagId: string;

  beforeAll(async () => {
    // Oldest first: three tagged "alpha" ideas, then seven untagged, one archived.
    const insert = async (title: string, status: "inbox" | "archived" = "inbox") => {
      const { data, error } = await user.client
        .from("ideas")
        .insert({ workspace_id: ctx.workspace.id, title, status })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    };
    const tagged = [await insert("alpha 1"), await insert("alpha 2"), await insert("alpha 3")];
    for (let i = 1; i <= 6; i += 1) await insert(`beta ${i}`);
    await insert("beta archived", "archived");
    for (const id of tagged) {
      await user.client
        .rpc("set_idea_tags", { target_idea_id: id, tag_names: ["early"] })
        .throwOnError();
    }
    const { data } = await user.client.from("tags").select("id").eq("name", "early").single();
    tagId = data!.id;
  });

  const inbox = { status: "inbox" as const, q: null, tagId: null };

  it("pages through every matching idea, newest first, with an exact total", async () => {
    const seen: string[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const result = await loadIdeas(ctx, inbox, { page, pageSize: 4 });
      expect(result).toMatchObject({ total: 9, page, pageCount: 3, pageSize: 4 });
      seen.push(...result.ideas.map((i) => i.title));
    }
    expect(seen).toEqual([
      "beta 6",
      "beta 5",
      "beta 4",
      "beta 3",
      "beta 2",
      "beta 1",
      "alpha 3",
      "alpha 2",
      "alpha 1",
    ]);
  });

  it("applies the tag filter before paging", async () => {
    const first = await loadIdeas(ctx, { ...inbox, tagId }, { page: 1, pageSize: 2 });
    const second = await loadIdeas(ctx, { ...inbox, tagId }, { page: 2, pageSize: 2 });
    expect(first).toMatchObject({ total: 3, pageCount: 2 });
    expect([...first.ideas, ...second.ideas].map((i) => i.title)).toEqual([
      "alpha 3",
      "alpha 2",
      "alpha 1",
    ]);
    // Each idea still carries its tags.
    expect(first.ideas[0]?.tags.map((t) => t.name)).toEqual(["early"]);
  });

  it("applies search and status before paging", async () => {
    const search = await loadIdeas(ctx, { ...inbox, q: "beta" }, { pageSize: 4 });
    expect(search).toMatchObject({ total: 6, pageCount: 2 });
    const all = await loadIdeas(ctx, { status: "all", q: "beta", tagId: null }, { pageSize: 4 });
    expect(all.total).toBe(7);
    const archived = await loadIdeas(ctx, { status: "archived", q: null, tagId: null });
    expect(archived.ideas.map((i) => i.title)).toEqual(["beta archived"]);
    const none = await loadIdeas(ctx, { ...inbox, q: "beta", tagId });
    expect(none).toMatchObject({ total: 0, page: 1, pageCount: 1, ideas: [] });
  });

  it("clamps a page past the end to the last page", async () => {
    const result = await loadIdeas(ctx, inbox, { page: 99, pageSize: 4 });
    expect(result).toMatchObject({ page: 3, pageCount: 3 });
    expect(result.ideas.map((i) => i.title)).toEqual(["alpha 1"]);
  });
});
