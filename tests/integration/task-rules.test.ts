import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createConfirmedUser, deleteUsers, personalWorkspaceId, type TestUser } from "./helpers";
import type { Database } from "@/types/database";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

let user: TestUser;
let workspaceId: string;

beforeAll(async () => {
  user = await createConfirmedUser("rules");
  workspaceId = await personalWorkspaceId(user.id);
});

afterAll(async () => {
  await deleteUsers(user);
});

async function createTask(fields: Omit<TaskInsert, "workspace_id">) {
  const { data, error } = await user.client
    .from("tasks")
    .insert({ workspace_id: workspaceId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function setStatus(id: string, status: Database["public"]["Enums"]["task_status"]) {
  return user.client.from("tasks").update({ status }).eq("id", id).select().single();
}

async function nextOccurrenceOf(id: string) {
  // recurs_from_task_id is selectable but never writable by clients.
  const { data } = await user.client.from("tasks").select("*").eq("recurs_from_task_id", id);
  return data ?? [];
}

describe("status transitions", () => {
  it("sets completed_at when done and clears it when reopened or cancelled", async () => {
    const task = await createTask({ title: "Transition" });
    expect(task.completed_at).toBeNull();

    const done = await setStatus(task.id, "done");
    expect(done.data?.completed_at).not.toBeNull();

    const reopened = await setStatus(task.id, "todo");
    expect(reopened.data?.completed_at).toBeNull();

    await setStatus(task.id, "in_progress");
    const cancelled = await setStatus(task.id, "cancelled");
    expect(cancelled.data?.completed_at).toBeNull();
  });

  it("keeps the original completion time when a done task is edited", async () => {
    const task = await createTask({ title: "Keep time" });
    const done = await setStatus(task.id, "done");
    const edited = await user.client
      .from("tasks")
      .update({ title: "Renamed" })
      .eq("id", task.id)
      .select()
      .single();
    expect(edited.data?.completed_at).toBe(done.data?.completed_at);
  });

  it("does not let clients write completed_at directly", async () => {
    const task = await createTask({ title: "No direct write" });
    const { error } = await user.client
      .from("tasks")
      .update({ completed_at: new Date().toISOString() } as never)
      .eq("id", task.id);
    expect(error?.code).toBe("42501");
  });

  it("requires a due date for a due time", async () => {
    const { error } = await user.client
      .from("tasks")
      .insert({ workspace_id: workspaceId, title: "x", due_time: "09:00" });
    expect(error?.code).toBe("23514");
  });
});

describe("dependencies", () => {
  it("blocks completion until the dependency is done or cancelled", async () => {
    const blocker = await createTask({ title: "Blocker" });
    const blocked = await createTask({ title: "Blocked" });
    await user.client
      .from("task_dependencies")
      .insert({ workspace_id: workspaceId, task_id: blocked.id, depends_on_task_id: blocker.id })
      .throwOnError();

    const early = await setStatus(blocked.id, "done");
    expect(early.error?.message).toContain("TASK_BLOCKED");

    // Starting work is fine; only completion is blocked.
    expect((await setStatus(blocked.id, "in_progress")).error).toBeNull();

    await setStatus(blocker.id, "done");
    expect((await setStatus(blocked.id, "done")).error).toBeNull();
  });

  it("treats a cancelled dependency as resolved", async () => {
    const blocker = await createTask({ title: "Dropped" });
    const blocked = await createTask({ title: "Proceeds" });
    await user.client
      .from("task_dependencies")
      .insert({ workspace_id: workspaceId, task_id: blocked.id, depends_on_task_id: blocker.id })
      .throwOnError();
    await setStatus(blocker.id, "cancelled");
    expect((await setStatus(blocked.id, "done")).error).toBeNull();
  });

  it("rejects self-dependencies and cycles of any length", async () => {
    const [x, y, z] = await Promise.all([
      createTask({ title: "X" }),
      createTask({ title: "Y" }),
      createTask({ title: "Z" }),
    ]);
    const link = (task: string, dependsOn: string) =>
      user.client
        .from("task_dependencies")
        .insert({ workspace_id: workspaceId, task_id: task, depends_on_task_id: dependsOn });

    // Rejected by the cycle trigger (which runs before the CHECK constraint) or the constraint.
    expect(["P0001", "23514"]).toContain((await link(x.id, x.id)).error?.code);
    expect((await link(x.id, y.id)).error).toBeNull();
    expect((await link(y.id, z.id)).error).toBeNull();
    expect((await link(y.id, x.id)).error?.message).toContain("DEPENDENCY_CYCLE");
    expect((await link(z.id, x.id)).error?.message).toContain("DEPENDENCY_CYCLE");
  });
});

describe("subtasks", () => {
  it("allows one level and deletes subtasks with their parent", async () => {
    const parent = await createTask({ title: "Parent" });
    const child = await createTask({ title: "Child", parent_task_id: parent.id });

    const { error } = await user.client
      .from("tasks")
      .insert({ workspace_id: workspaceId, title: "Grandchild", parent_task_id: child.id });
    expect(error?.message).toContain("SUBTASK_DEPTH");

    const other = await createTask({ title: "Other" });
    const nest = await user.client
      .from("tasks")
      .update({ parent_task_id: other.id })
      .eq("id", parent.id);
    expect(nest.error?.message).toContain("SUBTASK_DEPTH");

    await user.client.from("tasks").delete().eq("id", parent.id).throwOnError();
    const { data } = await user.client.from("tasks").select("id").eq("id", child.id);
    expect(data).toEqual([]);
  });
});

describe("recurrence", () => {
  it("creates exactly one next occurrence, even when completed twice", async () => {
    const task = await createTask({
      title: "Water plants",
      due_date: "2026-10-12",
      recurrence_frequency: "daily",
      recurrence_interval: 2,
    });
    await setStatus(task.id, "done");
    await setStatus(task.id, "todo");
    await setStatus(task.id, "done");

    const next = await nextOccurrenceOf(task.id);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      title: "Water plants",
      status: "todo",
      due_date: "2026-10-14",
      recurrence_frequency: "daily",
      recurrence_interval: 2,
      completed_at: null,
    });
  });

  it("copies tags, project, and priority to the next occurrence", async () => {
    const { data: tag } = await user.client
      .from("tags")
      .insert({ workspace_id: workspaceId, name: "chores" })
      .select()
      .single();
    const { data: project } = await user.client
      .from("projects")
      .insert({ workspace_id: workspaceId, name: "Home" })
      .select()
      .single();
    const task = await createTask({
      title: "Bins",
      due_date: "2026-10-12",
      priority: "high",
      project_id: project!.id,
      recurrence_frequency: "weekly",
    });
    await user.client
      .from("task_tags")
      .insert({ workspace_id: workspaceId, task_id: task.id, tag_id: tag!.id })
      .throwOnError();

    await setStatus(task.id, "done");
    const [next] = await nextOccurrenceOf(task.id);
    expect(next).toMatchObject({
      due_date: "2026-10-19",
      priority: "high",
      project_id: project!.id,
    });
    const { data: tags } = await user.client
      .from("task_tags")
      .select("tag_id")
      .eq("task_id", next!.id);
    expect(tags).toEqual([{ tag_id: tag!.id }]);
  });

  /** Completes a chain of occurrences and returns the due dates in order. */
  async function series(fields: Omit<TaskInsert, "workspace_id" | "title">, count: number) {
    let current = await createTask({ title: "Series", ...fields });
    const dates = [current.due_date];
    for (let i = 1; i < count; i += 1) {
      await setStatus(current.id, "done");
      const [next] = await nextOccurrenceOf(current.id);
      if (!next) break;
      dates.push(next.due_date);
      current = next;
    }
    return dates;
  }

  it("weekly on selected weekdays (Mon, Wed, Fri)", async () => {
    // 2026-10-12 is a Monday.
    const dates = await series(
      { due_date: "2026-10-12", recurrence_frequency: "weekly", recurrence_weekdays: [1, 3, 5] },
      5,
    );
    expect(dates).toEqual(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-19", "2026-10-21"]);
  });

  it("every two weeks on Tuesday and Thursday skips the off week", async () => {
    // 2026-10-13 is a Tuesday.
    const dates = await series(
      {
        due_date: "2026-10-13",
        recurrence_frequency: "weekly",
        recurrence_interval: 2,
        recurrence_weekdays: [2, 4],
      },
      4,
    );
    expect(dates).toEqual(["2026-10-13", "2026-10-15", "2026-10-27", "2026-10-29"]);
  });

  it("monthly on the 31st clamps short months without drifting", async () => {
    const dates = await series({ due_date: "2027-01-31", recurrence_frequency: "monthly" }, 4);
    expect(dates).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("monthly handles leap years", async () => {
    const dates = await series({ due_date: "2028-01-31", recurrence_frequency: "monthly" }, 2);
    expect(dates).toEqual(["2028-01-31", "2028-02-29"]);
  });

  it("stops after the end date", async () => {
    const dates = await series(
      { due_date: "2026-10-12", recurrence_frequency: "daily", recurrence_until: "2026-10-13" },
      5,
    );
    expect(dates).toEqual(["2026-10-12", "2026-10-13"]);
  });

  it("re-anchors when the due date is moved", async () => {
    const task = await createTask({
      title: "Rent",
      due_date: "2026-10-31",
      recurrence_frequency: "monthly",
    });
    await user.client
      .from("tasks")
      .update({ due_date: "2026-10-15" })
      .eq("id", task.id)
      .throwOnError();
    await setStatus(task.id, "done");
    const [next] = await nextOccurrenceOf(task.id);
    expect(next?.due_date).toBe("2026-11-15");
  });

  it("validates rules in the database", async () => {
    const noDate = await user.client
      .from("tasks")
      .insert({ workspace_id: workspaceId, title: "x", recurrence_frequency: "daily" });
    expect(noDate.error?.code).toBe("23514");

    const weekdaysOnDaily = await user.client.from("tasks").insert({
      workspace_id: workspaceId,
      title: "x",
      due_date: "2026-10-12",
      recurrence_frequency: "daily",
      recurrence_weekdays: [1],
    });
    expect(weekdaysOnDaily.error?.code).toBe("23514");

    const badWeekday = await user.client.from("tasks").insert({
      workspace_id: workspaceId,
      title: "x",
      due_date: "2026-10-12",
      recurrence_frequency: "weekly",
      recurrence_weekdays: [7],
    });
    expect(badWeekday.error?.code).toBe("23514");
  });

  it("does not create occurrences for cancelled or non-recurring tasks", async () => {
    const recurring = await createTask({
      title: "Skip me",
      due_date: "2026-10-12",
      recurrence_frequency: "daily",
    });
    await setStatus(recurring.id, "cancelled");
    expect(await nextOccurrenceOf(recurring.id)).toEqual([]);

    const once = await createTask({ title: "Once", due_date: "2026-10-12" });
    await setStatus(once.id, "done");
    expect(await nextOccurrenceOf(once.id)).toEqual([]);
  });
});

describe("tag assignment", () => {
  it("creates missing tags, reuses existing ones case-insensitively, and replaces the set", async () => {
    const task = await createTask({ title: "Tagged" });
    await user.client
      .rpc("set_task_tags", { target_task_id: task.id, tag_names: ["Deep Work", " errands "] })
      .throwOnError();
    await user.client
      .rpc("set_task_tags", { target_task_id: task.id, tag_names: ["deep work", "Calls", ""] })
      .throwOnError();

    const { data } = await user.client
      .from("task_tags")
      .select("tags(name)")
      .eq("task_id", task.id);
    const names = (data ?? []).map((row) => row.tags?.name).sort();
    expect(names).toEqual(["Calls", "Deep Work"]);

    const { data: all } = await user.client.from("tags").select("name").ilike("name", "deep work");
    expect(all).toHaveLength(1);
  });

  it("clears tags with an empty list", async () => {
    const task = await createTask({ title: "Untag" });
    await user.client
      .rpc("set_task_tags", { target_task_id: task.id, tag_names: ["temp"] })
      .throwOnError();
    await user.client
      .rpc("set_task_tags", { target_task_id: task.id, tag_names: [] })
      .throwOnError();
    const { data } = await user.client.from("task_tags").select("tag_id").eq("task_id", task.id);
    expect(data).toEqual([]);
  });
});
