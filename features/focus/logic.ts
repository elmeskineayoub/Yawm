/**
 * Pure focus-timer logic, kept free of React and the DOM so reload recovery, phase transitions,
 * and summaries are easy to test. The timer is driven by wall-clock timestamps, never by a
 * continuously-running JavaScript counter: remaining time is always derived from `startedAt` and
 * the configured length, so a reload (or a closed tab) recovers the correct state (REQUIREMENTS
 * 6.12).
 */

export type FocusPhase = "focus" | "short_break" | "long_break";

export const PHASE_LABELS: Record<FocusPhase, string> = {
  focus: "Focus",
  short_break: "Short break",
  long_break: "Long break",
};

export type FocusConfig = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** A long break replaces the short break after this many focus sessions. */
  longBreakEvery: number;
};

export const DEFAULT_FOCUS_CONFIG: FocusConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
};

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Validates durations read from storage back into sane bounds. */
export function clampConfig(input: Partial<FocusConfig> | null | undefined): FocusConfig {
  const d = DEFAULT_FOCUS_CONFIG;
  return {
    focusMinutes: clampInt(input?.focusMinutes, 1, 180, d.focusMinutes),
    shortBreakMinutes: clampInt(input?.shortBreakMinutes, 1, 60, d.shortBreakMinutes),
    longBreakMinutes: clampInt(input?.longBreakMinutes, 1, 120, d.longBreakMinutes),
    longBreakEvery: clampInt(input?.longBreakEvery, 2, 12, d.longBreakEvery),
  };
}

export function phaseSeconds(phase: FocusPhase, config: FocusConfig): number {
  const minutes =
    phase === "focus"
      ? config.focusMinutes
      : phase === "short_break"
        ? config.shortBreakMinutes
        : config.longBreakMinutes;
  return minutes * 60;
}

/**
 * The next phase after one completes. After a focus session comes a break (a long break every
 * `longBreakEvery` focus sessions); after any break comes focus.
 *
 * `completedFocusCount` is the number of focus sessions finished *including* the one that just
 * ended, so completing the 4th focus session (with longBreakEvery 4) leads to a long break.
 */
export function nextPhase(
  phase: FocusPhase,
  completedFocusCount: number,
  config: FocusConfig,
): FocusPhase {
  if (phase !== "focus") return "focus";
  return completedFocusCount > 0 && completedFocusCount % config.longBreakEvery === 0
    ? "long_break"
    : "short_break";
}

/** The in-browser timer state (persisted to localStorage, never to the server while running). */
export type RunningTimer = {
  /** Client-generated id used when the finished session is logged, so logging is idempotent. */
  id: string;
  phase: FocusPhase;
  taskId: string | null;
  /** The project this focus time counts toward (null: general focus). Fixed once started. */
  projectId: string | null;
  /** Epoch ms of the first start of this phase (the session's real start); null until started. */
  firstStartedAt: number | null;
  plannedSeconds: number;
  /** Epoch ms when the current running segment began; meaningless while paused. */
  startedAt: number;
  /** Elapsed seconds accumulated before the current segment (grows across pause/resume). */
  accumulatedSeconds: number;
  running: boolean;
};

/** localStorage key holding the RunningTimer (shared by the timer page and the shell's chip). */
export const FOCUS_TIMER_STORAGE_KEY = "yawm.focus.timer";

const PHASES: readonly FocusPhase[] = ["focus", "short_break", "long_break"];

/**
 * Parses the stored timer, returning null for anything missing or malformed. The value comes
 * from browser storage, so it is validated field by field rather than trusted.
 */
export function parseStoredTimer(raw: string | null): RunningTimer | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  if (
    typeof v.id !== "string" ||
    !PHASES.includes(v.phase as FocusPhase) ||
    !(v.taskId === null || typeof v.taskId === "string") ||
    // projectId and firstStartedAt were added later: absent in timers stored before then.
    !(v.projectId === undefined || v.projectId === null || typeof v.projectId === "string") ||
    !(v.firstStartedAt === undefined || v.firstStartedAt === null || finite(v.firstStartedAt)) ||
    !finite(v.plannedSeconds) ||
    v.plannedSeconds <= 0 ||
    !finite(v.startedAt) ||
    !finite(v.accumulatedSeconds) ||
    v.accumulatedSeconds < 0 ||
    typeof v.running !== "boolean"
  ) {
    return null;
  }
  return {
    id: v.id,
    phase: v.phase as FocusPhase,
    taskId: v.taskId as string | null,
    projectId: typeof v.projectId === "string" ? v.projectId : null,
    firstStartedAt: finite(v.firstStartedAt) ? v.firstStartedAt : null,
    plannedSeconds: v.plannedSeconds,
    startedAt: v.startedAt,
    accumulatedSeconds: v.accumulatedSeconds,
    running: v.running,
  };
}

/**
 * Whether the shell should show the timer: running, or paused part-way through. A fresh, untouched
 * timer and a finished one are not shown.
 */
export function isTimerActive(timer: RunningTimer | null, now: number): timer is RunningTimer {
  if (!timer || isComplete(timer, now)) return false;
  return timer.running || timer.accumulatedSeconds > 0;
}

/** Total elapsed seconds, including the currently-running segment. */
export function elapsedSeconds(timer: RunningTimer, now: number): number {
  const live = timer.running ? Math.max(0, (now - timer.startedAt) / 1000) : 0;
  return timer.accumulatedSeconds + live;
}

/** Whole seconds left before the phase completes (never negative). */
export function remainingSeconds(timer: RunningTimer, now: number): number {
  return Math.max(0, Math.ceil(timer.plannedSeconds - elapsedSeconds(timer, now)));
}

export function isComplete(timer: RunningTimer, now: number): boolean {
  return elapsedSeconds(timer, now) >= timer.plannedSeconds;
}

/** mm:ss (or h:mm:ss beyond an hour) for the countdown display. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Human total for summaries: "0m", "25m", "1h", "1h 20m". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export type FocusSessionLite = { session_type: FocusPhase; duration_seconds: number };

/** Total seconds spent in *focus* sessions (breaks don't count). */
export function totalFocusSeconds(sessions: readonly FocusSessionLite[]): number {
  return sessions
    .filter((s) => s.session_type === "focus")
    .reduce((sum, s) => sum + s.duration_seconds, 0);
}

/** Number of completed focus sessions. */
export function focusCount(sessions: readonly FocusSessionLite[]): number {
  return sessions.filter((s) => s.session_type === "focus").length;
}

/** A finished session, in the shape logFocusSession accepts. */
export type FocusSessionRecord = {
  id: string;
  task_id: string | null;
  project_id: string | null;
  session_type: FocusPhase;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
};

/** Whether a phase has been started (running now, or paused part-way). */
export function hasStarted(timer: RunningTimer): boolean {
  return timer.running || timer.accumulatedSeconds > 0;
}

/**
 * The session to save when a phase ends, from the time actually spent: running time only (paused
 * time is never counted), capped at the planned length.
 *
 * - "complete": the planned length was reached. Ends at the instant it was reached (which may be
 *   in the past after a reload), and counts the full planned length.
 * - "finish": stopped early by the user, who chose to keep the time. Ends now and counts the
 *   elapsed running time.
 *
 * Breaks never count toward a project or task. Returns null when there is nothing to save (less
 * than a second of focus).
 */
export function sessionFromTimer(
  timer: RunningTimer,
  now: number,
  how: "complete" | "finish",
): FocusSessionRecord | null {
  const elapsed = Math.min(timer.plannedSeconds, elapsedSeconds(timer, now));
  const duration = how === "complete" ? timer.plannedSeconds : Math.floor(elapsed);
  if (duration < 1) return null;
  const endMs =
    how === "complete"
      ? timer.running
        ? timer.startedAt + (timer.plannedSeconds - timer.accumulatedSeconds) * 1000
        : now
      : now;
  const startMs = Math.min(
    timer.firstStartedAt ?? endMs - duration * 1000,
    endMs - duration * 1000,
  );
  const isFocus = timer.phase === "focus";
  return {
    id: timer.id,
    task_id: isFocus ? timer.taskId : null,
    project_id: isFocus ? timer.projectId : null,
    session_type: timer.phase,
    started_at: new Date(startMs).toISOString(),
    ended_at: new Date(endMs).toISOString(),
    duration_seconds: duration,
  };
}

/** Sessions waiting to be confirmed by the server, kept in this browser so none is lost. */
export const FOCUS_PENDING_STORAGE_KEY = "yawm.focus.pending";

const PENDING_LIMIT = 50;

/** Reads the queue defensively (browser storage); anything malformed is dropped. */
export function parsePending(raw: string | null): FocusSessionRecord[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (s): s is FocusSessionRecord =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as FocusSessionRecord).id === "string" &&
        PHASES.includes((s as FocusSessionRecord).session_type) &&
        typeof (s as FocusSessionRecord).started_at === "string" &&
        typeof (s as FocusSessionRecord).ended_at === "string" &&
        Number.isInteger((s as FocusSessionRecord).duration_seconds),
    );
  } catch {
    return [];
  }
}

/** Adds a session once (by id); the server also ignores duplicate ids, so retries never double. */
export function enqueuePending(queue: FocusSessionRecord[], session: FocusSessionRecord) {
  if (queue.some((s) => s.id === session.id)) return queue;
  return [...queue, session].slice(-PENDING_LIMIT);
}

export function removePending(queue: FocusSessionRecord[], id: string) {
  return queue.filter((s) => s.id !== id);
}

export type ProjectFocusTotals = {
  todaySeconds: number;
  weekSeconds: number;
  totalSeconds: number;
};

/**
 * Focus time per project from session rows: today, this week, and all time. Only focus sessions
 * count (breaks never do). Each row is one stored session (ids are unique, and logging the same
 * session twice is a no-op), so time is never counted twice. Ranges are UTC instants [start, end).
 */
export function aggregateProjectFocus(
  rows: readonly {
    project_id: string | null;
    session_type: FocusPhase;
    duration_seconds: number;
    started_at: string;
  }[],
  day: { start: string; end: string },
  week: { start: string; end: string },
): Record<string, ProjectFocusTotals> {
  const totals: Record<string, ProjectFocusTotals> = {};
  for (const row of rows) {
    if (!row.project_id || row.session_type !== "focus") continue;
    const at = Date.parse(row.started_at);
    const t = (totals[row.project_id] ??= { todaySeconds: 0, weekSeconds: 0, totalSeconds: 0 });
    t.totalSeconds += row.duration_seconds;
    if (at >= Date.parse(week.start) && at < Date.parse(week.end))
      t.weekSeconds += row.duration_seconds;
    if (at >= Date.parse(day.start) && at < Date.parse(day.end))
      t.todaySeconds += row.duration_seconds;
  }
  return totals;
}
