import { describe, expect, it } from "vitest";
import {
  aggregateProjectFocus,
  elapsedSeconds,
  enqueuePending,
  parsePending,
  parseStoredTimer,
  removePending,
  sessionFromTimer,
  type FocusSessionRecord,
  type RunningTimer,
} from "@/features/focus/logic";
import { focusSessionSchema } from "@/features/focus/schemas";

const P = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";
const base: RunningTimer = {
  id: "33333333-3333-4333-8333-333333333333",
  phase: "focus",
  taskId: T,
  projectId: P,
  firstStartedAt: null,
  plannedSeconds: 25 * 60,
  startedAt: 0,
  accumulatedSeconds: 0,
  running: false,
};
const at = (min: number) => Date.parse("2026-11-05T09:00:00Z") + min * 60_000;

describe("actual focus time", () => {
  it("counts only running time across pause/resume", () => {
    // Ran 0–10, paused 10–20, resumed at 20; now 22 → 12 minutes of focus.
    const paused = {
      ...base,
      firstStartedAt: at(0),
      accumulatedSeconds: 600,
      startedAt: at(20),
      running: true,
    };
    expect(elapsedSeconds(paused, at(22))).toBe(720);
  });

  it("finishing early saves the actual elapsed time, from the real start to now", () => {
    const timer = {
      ...base,
      firstStartedAt: at(0),
      accumulatedSeconds: 600,
      startedAt: at(20),
      running: true,
    };
    const s = sessionFromTimer(timer, at(22), "finish")!;
    expect(s.duration_seconds).toBe(12 * 60);
    expect(s.started_at).toBe(new Date(at(0)).toISOString());
    expect(s.ended_at).toBe(new Date(at(22)).toISOString());
    expect(s).toMatchObject({ project_id: P, task_id: T, session_type: "focus", id: base.id });
  });

  it("a completed Pomodoro counts its full length, ending when the length was reached", () => {
    const timer = { ...base, firstStartedAt: at(0), startedAt: at(0), running: true };
    // Detected late (e.g. after a reload at minute 40): still 25 minutes, ending at minute 25.
    const s = sessionFromTimer(timer, at(40), "complete")!;
    expect(s.duration_seconds).toBe(25 * 60);
    expect(s.ended_at).toBe(new Date(at(25)).toISOString());
  });

  it("never counts more than the planned length", () => {
    const timer = { ...base, firstStartedAt: at(0), startedAt: at(0), running: true };
    expect(sessionFromTimer(timer, at(90), "finish")!.duration_seconds).toBe(25 * 60);
  });

  it("saves nothing for less than a second of focus", () => {
    expect(
      sessionFromTimer({ ...base, startedAt: at(0), running: true }, at(0) + 400, "finish"),
    ).toBeNull();
  });

  it("breaks never count toward a project or task", () => {
    const brk = {
      ...base,
      phase: "short_break" as const,
      plannedSeconds: 300,
      firstStartedAt: at(0),
      startedAt: at(0),
      running: true,
    };
    const s = sessionFromTimer(brk, at(5), "complete")!;
    expect(s.project_id).toBeNull();
    expect(s.task_id).toBeNull();
    expect(focusSessionSchema.safeParse({ ...s, project_id: P }).success).toBe(false);
  });
});

describe("stored timers", () => {
  it("still reads timers saved before projects existed", () => {
    const { projectId: _p, firstStartedAt: _f, ...old } = base;
    void _p;
    void _f;
    expect(parseStoredTimer(JSON.stringify(old))).toMatchObject({
      projectId: null,
      firstStartedAt: null,
    });
  });
  it("keeps the project and first start", () => {
    expect(parseStoredTimer(JSON.stringify({ ...base, firstStartedAt: at(0) }))).toMatchObject({
      projectId: P,
      firstStartedAt: at(0),
    });
    expect(parseStoredTimer(JSON.stringify({ ...base, projectId: 5 }))).toBeNull();
  });
});

describe("pending sessions queue", () => {
  const s = (id: string): FocusSessionRecord => ({
    id,
    task_id: null,
    project_id: P,
    session_type: "focus",
    started_at: "2026-11-05T09:00:00Z",
    ended_at: "2026-11-05T09:25:00Z",
    duration_seconds: 1500,
  });
  it("adds a session once, however often it is queued", () => {
    let q = enqueuePending([], s("a"));
    q = enqueuePending(q, s("a"));
    q = enqueuePending(q, s("b"));
    expect(q.map((x) => x.id)).toEqual(["a", "b"]);
    expect(removePending(q, "a").map((x) => x.id)).toEqual(["b"]);
  });
  it("drops anything malformed from storage", () => {
    expect(parsePending("nope")).toEqual([]);
    expect(parsePending(JSON.stringify([s("a"), { id: 1 }, null]))).toHaveLength(1);
  });
});

describe("aggregateProjectFocus", () => {
  const day = { start: "2026-11-05T00:00:00Z", end: "2026-11-06T00:00:00Z" };
  const week = { start: "2026-11-02T00:00:00Z", end: "2026-11-09T00:00:00Z" };
  const row = (
    project: string | null,
    started: string,
    seconds: number,
    type: "focus" | "short_break" = "focus",
  ) => ({
    project_id: project,
    session_type: type,
    duration_seconds: seconds,
    started_at: started,
  });

  it("splits each project's time into today, this week, and total, focus only", () => {
    const totals = aggregateProjectFocus(
      [
        row(P, "2026-11-05T09:00:00Z", 1500), // today
        row(P, "2026-11-03T09:00:00Z", 600), // this week
        row(P, "2026-10-20T09:00:00Z", 900), // earlier
        row(P, "2026-11-05T09:30:00Z", 300, "short_break"), // a break: never counted
        row(null, "2026-11-05T10:00:00Z", 1200), // general focus: no project
      ],
      day,
      week,
    );
    expect(totals[P]).toEqual({ todaySeconds: 1500, weekSeconds: 2100, totalSeconds: 3000 });
    expect(Object.keys(totals)).toEqual([P]);
  });
});
