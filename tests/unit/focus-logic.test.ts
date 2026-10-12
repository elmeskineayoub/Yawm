import { describe, expect, it } from "vitest";
import {
  clampConfig,
  DEFAULT_FOCUS_CONFIG,
  elapsedSeconds,
  focusCount,
  formatClock,
  formatDuration,
  isComplete,
  nextPhase,
  phaseSeconds,
  remainingSeconds,
  totalFocusSeconds,
  type RunningTimer,
} from "@/features/focus/logic";

const timer = (over: Partial<RunningTimer> = {}): RunningTimer => ({
  id: "t",
  phase: "focus",
  taskId: null,
  plannedSeconds: 60,
  startedAt: 0,
  accumulatedSeconds: 0,
  running: false,
  ...over,
});

describe("clampConfig", () => {
  it("keeps valid values and falls back on bad ones", () => {
    expect(clampConfig({ focusMinutes: 50, shortBreakMinutes: 10 })).toMatchObject({
      focusMinutes: 50,
      shortBreakMinutes: 10,
    });
    expect(clampConfig({ focusMinutes: 0, longBreakEvery: 99 })).toMatchObject({
      focusMinutes: 1,
      longBreakEvery: 12,
    });
    expect(clampConfig(null)).toEqual(DEFAULT_FOCUS_CONFIG);
  });
});

describe("phaseSeconds", () => {
  it("reads the matching duration for each phase", () => {
    const c = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };
    expect(phaseSeconds("focus", c)).toBe(1500);
    expect(phaseSeconds("short_break", c)).toBe(300);
    expect(phaseSeconds("long_break", c)).toBe(900);
  });
});

describe("nextPhase", () => {
  const c = DEFAULT_FOCUS_CONFIG; // longBreakEvery 4
  it("alternates focus and breaks, with a long break every Nth focus", () => {
    expect(nextPhase("focus", 1, c)).toBe("short_break");
    expect(nextPhase("focus", 3, c)).toBe("short_break");
    expect(nextPhase("focus", 4, c)).toBe("long_break");
    expect(nextPhase("focus", 8, c)).toBe("long_break");
    expect(nextPhase("short_break", 2, c)).toBe("focus");
    expect(nextPhase("long_break", 4, c)).toBe("focus");
  });
});

describe("elapsed / remaining / complete", () => {
  it("adds the live segment to the accumulated time while running", () => {
    const t = timer({ running: true, startedAt: 1_000_000, accumulatedSeconds: 5 });
    expect(elapsedSeconds(t, 1_000_000 + 10_000)).toBe(15);
    expect(remainingSeconds(t, 1_000_000 + 10_000)).toBe(45);
    expect(isComplete(t, 1_000_000 + 10_000)).toBe(false);
  });

  it("ignores the clock while paused", () => {
    const t = timer({ running: false, accumulatedSeconds: 30 });
    expect(remainingSeconds(t, 999_999_999)).toBe(30);
  });

  it("recovers a timer that finished while the tab was closed", () => {
    // startedAt 90s in the past, planned 60s: it is already complete on reload.
    const now = 2_000_000;
    const t = timer({ running: true, startedAt: now - 90_000, plannedSeconds: 60 });
    expect(remainingSeconds(t, now)).toBe(0);
    expect(isComplete(t, now)).toBe(true);
  });
});

describe("formatting", () => {
  it("formats the countdown clock", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3661)).toBe("1:01:01");
  });

  it("formats human durations for summaries", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(1500)).toBe("25m");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(4800)).toBe("1h 20m");
  });
});

describe("summaries", () => {
  const sessions = [
    { session_type: "focus" as const, duration_seconds: 1500 },
    { session_type: "short_break" as const, duration_seconds: 300 },
    { session_type: "focus" as const, duration_seconds: 1200 },
  ];
  it("counts only focus time, not breaks", () => {
    expect(totalFocusSeconds(sessions)).toBe(2700);
    expect(focusCount(sessions)).toBe(2);
  });
});
