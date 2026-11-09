import { describe, expect, it } from "vitest";
import { sumByDay } from "@/features/dashboard/logic";
import { buildDashboardModel, pickNextUp, type DashboardInput } from "@/features/dashboard/model";
import { isOpen } from "@/features/tasks/logic";
import { dashboardFixture, FIXTURE_NOW, FIXTURE_TODAY, fixtureTasks } from "../fixtures/dashboard";

describe("dashboard design fixture", () => {
  const input = dashboardFixture();

  it("has the agreed sizes", () => {
    expect(fixtureTasks.open.filter((t) => isOpen(t.status))).toHaveLength(25);
    expect(input.day.overdue).toHaveLength(2);
    expect(input.day.dueToday).toHaveLength(3);
    expect(input.projects).toHaveLength(5);
    expect(input.habits).toHaveLength(5);
    expect(input.goals).toHaveLength(3);
    expect(input.inbox).toBe(10);
    expect(input.day.scheduled).toHaveLength(3);
  });

  it("is deterministic", () => {
    expect(dashboardFixture()).toEqual(input);
  });
});

describe("buildDashboardModel on the fixture", () => {
  const input = dashboardFixture();
  const model = buildDashboardModel(input);

  it("summarises the workspace with the same counts the sections show", () => {
    expect(model.summary).toBe(
      "2 overdue, 13 done this week, 5 active projects, 3 active goals, 10 ideas to sort.",
    );
    expect(model.attention.overdue).toHaveLength(model.today.overdue);
    expect(model.attention.dueToday).toHaveLength(model.today.dueToday);
    expect(model.week.completed).toBe(input.insights!.weekCompleted);
    expect(model.projects).toHaveLength(5);
    expect(model.goals).toHaveLength(3);
  });

  it("picks today's first priority, with its reasons, then the next two", () => {
    expect(model.nextUp.primary?.task.title).toBe("Finalize pricing tiers copy");
    expect(model.nextUp.primary?.reasons.map((r) => r.label)).toEqual([
      "Today's priority",
      "Due today",
      "Urgent",
      "Scheduled 11:00",
    ]);
    expect(model.nextUp.then.map((c) => c.task.title)).toEqual([
      "Send revised quote to Northfield",
      "Review chapter 3 outline with supervisor notes",
    ]);
  });

  it("keeps focus totals consistent between today, the week, and each day", () => {
    const byDay = model.week.focusByDay!;
    expect(byDay).toHaveLength(7);
    expect(byDay[0]!.date).toBe("2026-11-09");
    expect(byDay.map((d) => d.seconds / 60)).toEqual([125, 150, 75, 0, 0, 0, 0]);
    expect(model.week.focusSeconds).toBe(byDay.reduce((s, d) => s + d.seconds, 0));
    expect(model.week.focusSeconds).toBe(input.focus!.weekSeconds);
    expect(byDay.find((d) => d.isToday)!.seconds).toBe(model.today.focusSeconds);
    expect(byDay.filter((d) => d.isFuture)).toHaveLength(4);
    expect(model.today.focusSessions).toBe(2);
    // Per-project focus this week adds up to the week (every focus session has a project here).
    const projectWeek = model.projects.reduce((s, p) => s + p.focusWeekSeconds, 0);
    expect(projectWeek).toBe(model.week.focusSeconds);
  });

  it("derives project progress from linked tasks", () => {
    const pricing = model.projects.find((p) => p.name === "Pricing page relaunch")!;
    expect(pricing).toMatchObject({ done: 8, total: 13, percent: 62, openTasks: 5 });
    expect(pricing.next?.title).toBe("Finalize pricing tiers copy");
    const client = model.projects.find((p) => p.name === "Client site: Northfield Bakery")!;
    expect(client.dueTone).toBe("warning");
    const openInProjects = model.projects.reduce((s, p) => s + p.openTasks, 0);
    const openWithoutProject = fixtureTasks.open.filter((t) => !t.project_id).length;
    expect(openInProjects + openWithoutProject).toBe(25);
  });

  it("reports habits due today with their state and streaks", () => {
    expect(model.today.habitsDone).toBe(2);
    expect(model.today.habitsDue).toBe(5);
    const read = model.habits!.find((h) => h.title === "Read")!;
    expect(read).toMatchObject({ done: false, progress: "12/20 pages", streakShort: "9d" });
    const run = model.habits!.find((h) => h.title === "Run")!;
    expect(run).toMatchObject({ done: true, progress: "2/3 this week" });
  });

  it("shows goal progress by measure first, then milestones", () => {
    const [thesis, run, customers] = model.goals;
    expect(thesis).toMatchObject({ percent: 40, progressLabel: "2 of 5 milestones" });
    expect(thesis!.next?.title).toBe("Chapter 3 draft to supervisor");
    expect(run).toMatchObject({ percent: 66, progressLabel: "14/21.1 km longest run" });
    expect(customers).toMatchObject({ percent: 68, progressLabel: "27/40 customers" });
  });

  it("lists the next block still ahead, and milestones and upcoming work this week", () => {
    expect(model.today.nextBlock?.title).toBe("Pricing page copy");
    expect(model.attention.milestones.map((m) => m.title)).toEqual(["Run 15 km without stopping"]);
    expect(model.attention.upcoming).toHaveLength(6);
    expect(model.attention.upcoming.every((t) => t.due_date! > FIXTURE_TODAY)).toBe(true);
  });
});

describe("pickNextUp", () => {
  const base = dashboardFixture();
  const without = (patch: Partial<DashboardInput["day"]>): DashboardInput => ({
    ...base,
    day: { ...base.day, ...patch },
  });

  it("without priorities, puts overdue work first, highest priority first", () => {
    const next = pickNextUp(without({ priorities: [] }));
    expect(next.primary?.task.title).toBe("Send revised quote to Northfield");
    expect(next.then.map((c) => c.task.title)).toEqual([
      "Book physio follow-up",
      "Finalize pricing tiers copy",
    ]);
  });

  it("falls back to a block still ahead today, and ignores blocks already over", () => {
    const next = pickNextUp(without({ priorities: [], overdue: [], dueToday: [] }));
    // The 11:00 block's task is due today (filtered out above), so only the 15:00 block's task,
    // overdue and also filtered out, remains: nothing is known to pick.
    expect(next.primary).toBeNull();
    const later = pickNextUp({
      ...without({ priorities: [], overdue: [], dueToday: base.day.dueToday }),
      now: FIXTURE_NOW + 3 * 3_600_000, // 13:40, after the pricing block ended
    });
    expect(later.primary?.reasons.some((r) => r.label.startsWith("Scheduled"))).toBe(false);
  });

  it("moves a task blocked by dependencies behind ready work", () => {
    const [first, ...rest] = base.day.dueToday;
    const blocked = { ...first!, openBlockers: 2 };
    const next = pickNextUp(without({ priorities: [], overdue: [], dueToday: [blocked, ...rest] }));
    expect(next.primary?.task.id).not.toBe(blocked.id);
    const all = [next.primary, ...next.then].map((c) => c?.task.id);
    expect(all.indexOf(blocked.id)).toBe(all.length - 1);
  });

  it("returns nothing when nothing is pressing", () => {
    const next = pickNextUp(
      without({ priorities: [], overdue: [], dueToday: [], upcoming: [], scheduled: [] }),
    );
    expect(next).toEqual({ primary: null, then: [] });
  });
});

describe("sumByDay", () => {
  it("sums seconds into contiguous local days and ignores the rest", () => {
    expect(
      sumByDay(
        [
          { date: "2026-11-09", seconds: 60 },
          { date: "2026-11-09", seconds: 30 },
          { date: "2026-11-11", seconds: 10 },
          { date: "2026-11-20", seconds: 999 },
        ],
        "2026-11-09",
        3,
      ),
    ).toEqual([
      { date: "2026-11-09", seconds: 90 },
      { date: "2026-11-10", seconds: 0 },
      { date: "2026-11-11", seconds: 10 },
    ]);
  });
});

describe("designPreviewEnabled", () => {
  it("is on only in development with the explicit flag", async () => {
    const { designPreviewEnabled } = await import("@/lib/design-preview");
    expect(designPreviewEnabled({ NODE_ENV: "development", YAWM_DESIGN_PREVIEW: "1" })).toBe(true);
    expect(designPreviewEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(designPreviewEnabled({ NODE_ENV: "production", YAWM_DESIGN_PREVIEW: "1" })).toBe(false);
    expect(designPreviewEnabled({ NODE_ENV: "test", YAWM_DESIGN_PREVIEW: "true" })).toBe(false);
  });
});
