import { describe, expect, it } from "vitest";
import { isTimerActive, parseStoredTimer, type RunningTimer } from "@/features/focus/logic";
import { contentWidthFor, isActivePath } from "@/lib/navigation";
import { isSidebarCollapsed } from "@/lib/sidebar-cookie";

describe("contentWidthFor", () => {
  it("gives the Planner the full width", () => {
    expect(contentWidthFor("/planner")).toBe("wide");
  });
  it("keeps notes in their two-pane width when one is open", () => {
    expect(contentWidthFor("/notes/7c1a")).toBe("standard");
  });

  it("keeps text detail pages at a reading measure", () => {
    expect(contentWidthFor("/journal/7c1a")).toBe("reading");
    expect(contentWidthFor("/inbox/7c1a")).toBe("reading");
    expect(contentWidthFor("/tasks/7c1a")).toBe("reading");
  });
  it("uses the standard width for lists and everything else", () => {
    for (const path of ["/dashboard", "/notes", "/journal", "/inbox", "/tasks", "/settings"]) {
      expect(contentWidthFor(path)).toBe("standard");
    }
  });
});

describe("isActivePath", () => {
  it("matches the section and its children, not lookalike prefixes", () => {
    expect(isActivePath("/tasks", "/tasks")).toBe(true);
    expect(isActivePath("/tasks/abc", "/tasks")).toBe(true);
    expect(isActivePath("/tasksx", "/tasks")).toBe(false);
  });
});

describe("isSidebarCollapsed", () => {
  it("is collapsed only for the explicit cookie value", () => {
    expect(isSidebarCollapsed("collapsed")).toBe(true);
    expect(isSidebarCollapsed("expanded")).toBe(false);
    expect(isSidebarCollapsed(undefined)).toBe(false);
    expect(isSidebarCollapsed("garbage")).toBe(false);
  });
});

describe("parseStoredTimer", () => {
  const timer: RunningTimer = {
    id: "t1",
    phase: "focus",
    taskId: null,
    projectId: null,
    firstStartedAt: null,
    plannedSeconds: 1500,
    startedAt: 1_000_000,
    accumulatedSeconds: 0,
    running: true,
  };

  it("round-trips a valid timer", () => {
    expect(parseStoredTimer(JSON.stringify(timer))).toEqual(timer);
  });

  it("rejects missing, malformed, or tampered values", () => {
    expect(parseStoredTimer(null)).toBeNull();
    expect(parseStoredTimer("not json")).toBeNull();
    expect(parseStoredTimer("42")).toBeNull();
    expect(parseStoredTimer(JSON.stringify({ ...timer, phase: "nap" }))).toBeNull();
    expect(parseStoredTimer(JSON.stringify({ ...timer, plannedSeconds: 0 }))).toBeNull();
    expect(parseStoredTimer(JSON.stringify({ ...timer, accumulatedSeconds: -5 }))).toBeNull();
    expect(parseStoredTimer(JSON.stringify({ ...timer, running: "yes" }))).toBeNull();
    expect(parseStoredTimer(JSON.stringify({ ...timer, taskId: 7 }))).toBeNull();
  });

  it("is active while running or paused part-way, not when fresh or finished", () => {
    const now = timer.startedAt + 60_000;
    expect(isTimerActive(timer, now)).toBe(true);
    expect(isTimerActive({ ...timer, running: false, accumulatedSeconds: 300 }, now)).toBe(true);
    expect(isTimerActive({ ...timer, running: false, accumulatedSeconds: 0 }, now)).toBe(false);
    expect(isTimerActive(timer, timer.startedAt + 1_501_000)).toBe(false);
    expect(isTimerActive(null, now)).toBe(false);
  });
});
