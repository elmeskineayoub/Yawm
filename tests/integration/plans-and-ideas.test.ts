import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createConfirmedUser, deleteUsers, personalWorkspaceId, type TestUser } from "./helpers";
import type { Database } from "@/types/database";

type Period = Database["public"]["Enums"]["plan_period"];

let user: TestUser;
let workspaceId: string;

beforeAll(async () => {
  user = await createConfirmedUser("plans");
  workspaceId = await personalWorkspaceId(user.id);
});

afterAll(async () => {
  await deleteUsers(user);
});

function insertPlan(period: Period, periodStart: string, parentId: string | null = null) {
  return user.client
    .from("plans")
    .insert({
      workspace_id: workspaceId,
      period,
      period_start: periodStart,
      parent_plan_id: parentId,
    })
    .select()
    .single();
}

describe("plan hierarchy", () => {
  let yearId: string;
  let monthId: string;
  let weekId: string;

  beforeAll(async () => {
    yearId = (await insertPlan("year", "2027-01-01")).data!.id;
    monthId = (await insertPlan("month", "2027-03-01", yearId)).data!.id;
    weekId = (await insertPlan("week", "2027-03-08", monthId)).data!.id;
  });

  it("links year → month → week → day", async () => {
    const day = await insertPlan("day", "2027-03-10", weekId);
    expect(day.error).toBeNull();

    const chain: string[] = [];
    let id: string | null = day.data!.id;
    while (id) {
      const { data }: { data: { period: string; parent_plan_id: string | null } | null } =
        await user.client.from("plans").select("period, parent_plan_id").eq("id", id).single();
      chain.push(data!.period);
      id = data!.parent_plan_id;
    }
    expect(chain).toEqual(["day", "week", "month", "year"]);
  });

  it("requires the parent to be exactly one level up", async () => {
    const skip = await insertPlan("day", "2027-03-11", monthId);
    expect(skip.error?.message).toContain("PLAN_PARENT_LEVEL");
    const sideways = await insertPlan("month", "2027-04-01", monthId);
    expect(sideways.error?.message).toContain("PLAN_PARENT_LEVEL");
    const yearWithParent = await insertPlan("year", "2028-01-01", yearId);
    expect(yearWithParent.error?.message).toContain("PLAN_PARENT_LEVEL");
  });

  it("requires the parent period to contain the child", async () => {
    const outsideMonth = await insertPlan("week", "2027-04-05", monthId);
    expect(outsideMonth.error?.message).toContain("PLAN_PARENT_RANGE");
    const outsideWeek = await insertPlan("day", "2027-03-15", weekId);
    expect(outsideWeek.error?.message).toContain("PLAN_PARENT_RANGE");
  });

  it("allows a week that starts in the parent month and ends in the next", async () => {
    const straddling = await insertPlan("week", "2027-03-29", monthId);
    expect(straddling.error).toBeNull();
  });

  it("aligns year and month starts and allows one plan per period", async () => {
    expect((await insertPlan("year", "2029-02-01")).error?.code).toBe("23514");
    expect((await insertPlan("month", "2029-02-15")).error?.code).toBe("23514");
    expect((await insertPlan("month", "2027-03-01")).error?.code).toBe("23505");
  });

  it("keeps children when a parent is deleted, unlinking them", async () => {
    const year = (await insertPlan("year", "2030-01-01")).data!;
    const month = (await insertPlan("month", "2030-05-01", year.id)).data!;
    await user.client.from("plans").delete().eq("id", year.id).throwOnError();
    const { data } = await user.client
      .from("plans")
      .select("parent_plan_id")
      .eq("id", month.id)
      .single();
    expect(data?.parent_plan_id).toBeNull();
  });
});

describe("plan items", () => {
  let planId: string;
  let taskId: string;
  let projectId: string;

  beforeAll(async () => {
    planId = (await insertPlan("week", "2027-06-07")).data!.id;
    taskId = (
      await user.client
        .from("tasks")
        .insert({ workspace_id: workspaceId, title: "Planned task" })
        .select()
        .single()
    ).data!.id;
    projectId = (
      await user.client
        .from("projects")
        .insert({ workspace_id: workspaceId, name: "Planned project" })
        .select()
        .single()
    ).data!.id;
  });

  const link = (fields: { task_id?: string; project_id?: string }) =>
    user.client
      .from("plan_items")
      .insert({ workspace_id: workspaceId, plan_id: planId, ...fields });

  it("links exactly one task or project, once per plan", async () => {
    expect((await link({ task_id: taskId })).error).toBeNull();
    expect((await link({ project_id: projectId })).error).toBeNull();
    expect((await link({ task_id: taskId })).error?.code).toBe("23505");
    expect((await link({})).error?.code).toBe("23514");
    expect((await link({ task_id: taskId, project_id: projectId })).error?.code).toBe("23514");
  });

  it("removes the link, not the plan, when the task is deleted", async () => {
    const { data: temp } = await user.client
      .from("tasks")
      .insert({ workspace_id: workspaceId, title: "Temp" })
      .select()
      .single();
    await link({ task_id: temp!.id });
    await user.client.from("tasks").delete().eq("id", temp!.id).throwOnError();
    const { data } = await user.client.from("plan_items").select("id").eq("task_id", temp!.id);
    expect(data).toEqual([]);
    const plan = await user.client.from("plans").select("id").eq("id", planId);
    expect(plan.data).toHaveLength(1);
  });
});

describe("idea conversion", () => {
  async function createIdea(title: string, body: string | null) {
    const { data, error } = await user.client
      .from("ideas")
      .insert({ workspace_id: workspaceId, title, body })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  it("turns an idea into a task, copying content and tags, and keeps the idea", async () => {
    const idea = await createIdea("Start running", "Couch to 5k, three times a week");
    const { data: tag } = await user.client
      .from("tags")
      .insert({ workspace_id: workspaceId, name: "health" })
      .select()
      .single();
    await user.client
      .from("idea_tags")
      .insert({ workspace_id: workspaceId, idea_id: idea.id, tag_id: tag!.id })
      .throwOnError();

    const { data: taskId, error } = await user.client.rpc("convert_idea_to_task", {
      idea_id: idea.id,
    });
    expect(error).toBeNull();

    const { data: task } = await user.client.from("tasks").select("*").eq("id", taskId!).single();
    expect(task).toMatchObject({
      title: "Start running",
      description: "Couch to 5k, three times a week",
      status: "todo",
    });
    const { data: tags } = await user.client
      .from("task_tags")
      .select("tag_id")
      .eq("task_id", taskId!);
    expect(tags).toEqual([{ tag_id: tag!.id }]);

    const { data: after } = await user.client.from("ideas").select("*").eq("id", idea.id).single();
    expect(after).toMatchObject({
      title: "Start running",
      body: "Couch to 5k, three times a week",
      status: "archived",
      converted_task_id: taskId,
    });
  });

  it("is idempotent: converting twice returns the same task", async () => {
    const idea = await createIdea("Call the bank", null);
    const first = await user.client.rpc("convert_idea_to_task", { idea_id: idea.id });
    const second = await user.client.rpc("convert_idea_to_task", { idea_id: idea.id });
    expect(second.data).toBe(first.data);
    const { data } = await user.client.from("tasks").select("id").eq("title", "Call the bank");
    expect(data).toHaveLength(1);
  });

  it("turns an idea into a project", async () => {
    const idea = await createIdea("Learn Spanish", "Aim for B1 by summer");
    const { data: projectId, error } = await user.client.rpc("convert_idea_to_project", {
      idea_id: idea.id,
    });
    expect(error).toBeNull();
    const { data: project } = await user.client
      .from("projects")
      .select("name, description, status")
      .eq("id", projectId!)
      .single();
    expect(project).toEqual({
      name: "Learn Spanish",
      description: "Aim for B1 by summer",
      status: "active",
    });
  });

  it("keeps the idea when the converted task is later deleted", async () => {
    const idea = await createIdea("Temporary", "keep me");
    const { data: taskId } = await user.client.rpc("convert_idea_to_task", { idea_id: idea.id });
    await user.client.from("tasks").delete().eq("id", taskId!).throwOnError();
    const { data } = await user.client.from("ideas").select("*").eq("id", idea.id).single();
    expect(data).toMatchObject({ body: "keep me", converted_task_id: null });
  });
});
