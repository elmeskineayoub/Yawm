import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadDashboardInsights } from "@/features/dashboard/queries";
import { periodStart, todayIn, type IsoDate } from "@/lib/dates";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { createConfirmedUser, deleteUsers, personalWorkspaceId, type TestUser } from "./helpers";

let alice: TestUser;
let ws: string;

const today: IsoDate = todayIn("UTC");

beforeAll(async () => {
  alice = await createConfirmedUser("alice-dash");
  ws = await personalWorkspaceId(alice.id);
});

afterAll(async () => {
  await deleteUsers(alice);
});

const ctx = (): WorkspaceContext =>
  ({
    supabase: alice.client,
    user: { id: alice.id, email: alice.email },
    workspace: { id: ws, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today,
  }) as WorkspaceContext;

describe("dashboard insights", () => {
  it("counts a completed task in today's trend bucket and the week rate", async () => {
    const baseline = await loadDashboardInsights(ctx());
    expect(baseline.trend).toHaveLength(7);
    expect(baseline.trend.at(-1)?.date).toBe(today);

    // A completed task (completed_at = now, which is today in UTC).
    await alice.client
      .from("tasks")
      .insert({ workspace_id: ws, title: "Done today", status: "done" })
      .throwOnError();
    // An open task due this week counts against the weekly completion rate.
    await alice.client
      .from("tasks")
      .insert({
        workspace_id: ws,
        title: "Open this week",
        status: "todo",
        due_date: periodStart("week", today, 1),
      })
      .throwOnError();

    const after = await loadDashboardInsights(ctx());
    expect(after.trend.at(-1)!.count).toBe(baseline.trend.at(-1)!.count + 1);
    expect(after.trendTotal).toBe(baseline.trendTotal + 1);
    expect(after.weekCompleted).toBeGreaterThanOrEqual(1);
    expect(after.weekOpenDue).toBeGreaterThanOrEqual(1);
    // done / (done + open) as a percentage.
    expect(after.weekTaskRate).toBe(
      Math.round((after.weekCompleted / (after.weekCompleted + after.weekOpenDue)) * 100),
    );
  });
});
