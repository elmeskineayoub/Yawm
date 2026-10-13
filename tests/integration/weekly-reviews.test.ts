import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveReviewFieldInWorkspace } from "@/features/reviews/mutations";
import { loadWeeklyReview } from "@/features/reviews/queries";
import { periodStart, todayIn, type IsoDate } from "@/lib/dates";
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
let carol: TestUser;
let ws: string;
let carolWs: string;

const today: IsoDate = todayIn("UTC");
const weekStart = periodStart("week", today, 1);

beforeAll(async () => {
  alice = await createConfirmedUser("alice-rev");
  carol = await createConfirmedUser("carol-rev");
  [ws, carolWs] = await Promise.all([personalWorkspaceId(alice.id), personalWorkspaceId(carol.id)]);
});

afterAll(async () => {
  await deleteUsers(alice, carol);
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

describe("weekly review reflection", () => {
  it("creates the row on first save and updates it after, one row per week", async () => {
    expect(
      await saveReviewFieldInWorkspace(alice.client, ws, weekStart, "went_well", "Shipped Phase 5"),
    ).toMatchObject({ ok: true });
    expect(
      await saveReviewFieldInWorkspace(alice.client, ws, weekStart, "lessons", "Push early"),
    ).toMatchObject({ ok: true });
    // Overwrite the first field.
    await saveReviewFieldInWorkspace(alice.client, ws, weekStart, "went_well", "Shipped reminders");

    const review = await loadWeeklyReview(ctx(), weekStart);
    expect(review.text.went_well).toBe("Shipped reminders");
    expect(review.text.lessons).toBe("Push early");
    expect(review.text.could_improve).toBeNull();

    const { count } = await adminClient()
      .from("weekly_reviews")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws)
      .eq("week_start", weekStart);
    expect(count).toBe(1);
  });

  it("clears a field when saved empty (null)", async () => {
    await saveReviewFieldInWorkspace(alice.client, ws, weekStart, "lessons", null);
    const review = await loadWeeklyReview(ctx(), weekStart);
    expect(review.text.lessons).toBeNull();
  });
});

describe("weekly statistics", () => {
  it("counts completed and carried-forward tasks and focus time for the week", async () => {
    await alice.client
      .from("tasks")
      .insert({ workspace_id: ws, title: "Done this week", status: "done" })
      .throwOnError();
    await alice.client
      .from("tasks")
      .insert({ workspace_id: ws, title: "Due this week", status: "todo", due_date: weekStart })
      .throwOnError();
    await alice.client
      .from("focus_sessions")
      .insert({
        id: randomUUID(),
        workspace_id: ws,
        session_type: "focus",
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 1500,
      })
      .throwOnError();

    const review = await loadWeeklyReview(ctx(), weekStart);
    expect(review.completedCount).toBeGreaterThanOrEqual(1);
    expect(review.completedTasks.some((t) => t.title === "Done this week")).toBe(true);
    expect(review.carriedForward).toBeGreaterThanOrEqual(1);
    expect(review.focusSeconds).toBeGreaterThanOrEqual(1500);
  });
});

describe("isolation", () => {
  it("cannot write a review into a non-member workspace", async () => {
    const insert = await alice.client
      .from("weekly_reviews")
      .insert({ workspace_id: carolWs, week_start: weekStart, went_well: "x" } as never);
    expect(insert.error?.code).toBe(INSUFFICIENT_PRIVILEGE);

    expect(
      await saveReviewFieldInWorkspace(alice.client, carolWs, weekStart, "went_well", "x"),
    ).toMatchObject({ ok: false });
  });
});
