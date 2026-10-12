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
  plannedSeconds: number;
  /** Epoch ms when the current running segment began; meaningless while paused. */
  startedAt: number;
  /** Elapsed seconds accumulated before the current segment (grows across pause/resume). */
  accumulatedSeconds: number;
  running: boolean;
};

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
