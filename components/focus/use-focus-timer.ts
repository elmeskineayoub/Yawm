"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { logFocusSession } from "@/features/focus/actions";
import {
  clampConfig,
  DEFAULT_FOCUS_CONFIG,
  enqueuePending,
  FOCUS_PENDING_STORAGE_KEY,
  FOCUS_TIMER_STORAGE_KEY,
  formatDuration,
  hasStarted,
  isComplete,
  nextPhase,
  parsePending,
  parseStoredTimer,
  PHASE_LABELS,
  phaseSeconds,
  remainingSeconds,
  removePending,
  sessionFromTimer,
  elapsedSeconds,
  type FocusConfig,
  type FocusPhase,
  type FocusSessionRecord,
  type RunningTimer,
} from "@/features/focus/logic";
import { safeAction } from "@/lib/safe-action";

/*
 * The one focus-timer engine. Every view (the Focus page's standard and immersive layouts, and the
 * compact timer on Today) renders from this hook, so the timer logic exists once.
 *
 * - Driven by wall-clock timestamps, never a running counter: a reload or a closed tab recovers it.
 * - Only running time counts. Pausing stops the clock; breaks never count toward a project.
 * - The project and task are fixed once a phase has started; change them after finishing or
 *   discarding.
 * - A finished session goes into a queue in this browser first and leaves it only when the server
 *   confirms it, so a lost connection never loses time. Session ids are reused on retry and the
 *   server ignores duplicates, so a session is never counted twice.
 */

const CONFIG_KEY = "yawm.focus.config";
const CYCLE_KEY = "yawm.focus.cycle";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota): the timer still runs in this tab.
  }
}
function readPending(): FocusSessionRecord[] {
  try {
    return parsePending(window.localStorage.getItem(FOCUS_PENDING_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function freshTimer(
  phase: FocusPhase,
  config: FocusConfig,
  carry: { taskId: string | null; projectId: string | null },
): RunningTimer {
  return {
    id: crypto.randomUUID(),
    phase,
    taskId: carry.taskId,
    projectId: carry.projectId,
    firstStartedAt: null,
    plannedSeconds: phaseSeconds(phase, config),
    startedAt: 0,
    accumulatedSeconds: 0,
    running: false,
  };
}

const subscribe = () => () => {};

export type FocusTimerApi = ReturnType<typeof useFocusTimer>;

export function useFocusTimer({
  projectNames = {},
}: {
  /** For messages such as "Saved 12m to Newsletter". */
  projectNames?: Record<string, string>;
} = {}) {
  const router = useRouter();
  // False during SSR and the first client render: avoids a hydration mismatch from browser storage.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const [config, setConfig] = useState<FocusConfig>(() =>
    clampConfig(readJson(CONFIG_KEY, DEFAULT_FOCUS_CONFIG)),
  );
  const [timer, setTimer] = useState<RunningTimer>(() => {
    let stored: RunningTimer | null = null;
    try {
      stored =
        typeof window === "undefined"
          ? null
          : parseStoredTimer(window.localStorage.getItem(FOCUS_TIMER_STORAGE_KEY));
    } catch {
      stored = null;
    }
    return (
      stored ??
      freshTimer("focus", clampConfig(readJson(CONFIG_KEY, DEFAULT_FOCUS_CONFIG)), {
        taskId: null,
        projectId: null,
      })
    );
  });
  const [cycle, setCycle] = useState<number>(() => readJson(CYCLE_KEY, 0));
  const [now, setNow] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Latest values for callbacks that must not read state captured at setup time.
  const timerRef = useRef(timer);
  const configRef = useRef(config);
  const cycleRef = useRef(cycle);
  const namesRef = useRef(projectNames);
  const processedRef = useRef<string | null>(null);
  /** Sessions being sent right now: never send the same one twice at once. */
  const inFlight = useRef(new Set<string>());
  const retried = useRef(false);
  useEffect(() => {
    timerRef.current = timer;
    writeJson(FOCUS_TIMER_STORAGE_KEY, timer);
  }, [timer]);
  useEffect(() => {
    configRef.current = config;
    writeJson(CONFIG_KEY, config);
  }, [config]);
  useEffect(() => {
    cycleRef.current = cycle;
    writeJson(CYCLE_KEY, cycle);
  }, [cycle]);
  useEffect(() => {
    namesRef.current = projectNames;
  }, [projectNames]);

  /** Sends one queued session; keeps it queued if the server could not be reached. */
  const send = useCallback(
    async (session: FocusSessionRecord, announce: boolean) => {
      if (inFlight.current.has(session.id)) return;
      inFlight.current.add(session.id);
      const result = await safeAction(() => logFocusSession(session));
      inFlight.current.delete(session.id);
      if (result.ok) {
        writeJson(FOCUS_PENDING_STORAGE_KEY, removePending(readPending(), session.id));
        if (!result.data.projectSaved) {
          toast.warning(
            "Saved, but without its project: project tracking needs a database update.",
          );
        } else if (announce && session.session_type === "focus") {
          const project = session.project_id ? namesRef.current[session.project_id] : null;
          toast.success(
            `Saved ${formatDuration(session.duration_seconds)} of focus${project ? ` to ${project}` : ""}`,
          );
        }
        router.refresh();
        return;
      }
      if (/reach the server|offline/i.test(result.error)) {
        // Kept in the queue; retried on the next save or the next visit.
        toast.error(`${result.error} It's kept on this device and will be retried.`);
        return;
      }
      // Rejected for good (e.g. the project was deleted): don't retry forever.
      writeJson(FOCUS_PENDING_STORAGE_KEY, removePending(readPending(), session.id));
      toast.error(result.error);
    },
    [router],
  );

  const record = useCallback(
    (session: FocusSessionRecord, announce = true) => {
      writeJson(FOCUS_PENDING_STORAGE_KEY, enqueuePending(readPending(), session));
      void send(session, announce);
    },
    [send],
  );

  // Retry anything left from an earlier visit, once per mount (idempotent: the server ignores
  // known ids, and in-flight sessions are not sent again).
  useEffect(() => {
    if (retried.current) return;
    retried.current = true;
    for (const session of readPending()) void send(session, false);
  }, [send]);

  const advance = useCallback((t: RunningTimer, countAsFocus: boolean) => {
    const nextCount = countAsFocus ? cycleRef.current + 1 : cycleRef.current;
    if (countAsFocus) setCycle(nextCount);
    setTimer(
      freshTimer(nextPhase(t.phase, nextCount, configRef.current), configRef.current, {
        taskId: t.taskId,
        projectId: t.projectId,
      }),
    );
  }, []);

  const complete = useCallback(
    (t: RunningTimer) => {
      const session = sessionFromTimer(t, Date.now(), "complete");
      if (session) record(session);
      advance(t, t.phase === "focus");
      toast.success(`${PHASE_LABELS[t.phase]} complete`);
    },
    [advance, record],
  );

  // Repaint the countdown and detect completion from timestamps.
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      // Cheap: a short list in this browser. Keeps "waiting to be saved" honest while offline.
      setPendingCount(readPending().length);
      const t = timerRef.current;
      if (t.running && processedRef.current !== t.id && isComplete(t, Date.now())) {
        processedRef.current = t.id;
        complete(t);
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [complete]);

  const started = hasStarted(timer);
  const remaining = mounted && now ? remainingSeconds(timer, now) : timer.plannedSeconds;
  const elapsed = mounted && now ? Math.min(timer.plannedSeconds, elapsedSeconds(timer, now)) : 0;
  const progress = timer.plannedSeconds ? Math.min(1, elapsed / timer.plannedSeconds) : 0;

  return {
    mounted,
    timer,
    config,
    cycle,
    remaining,
    elapsed,
    progress,
    started,
    pendingCount,
    status: !mounted ? "" : timer.running ? "Running" : started ? "Paused" : "Ready",

    start: () =>
      setTimer((t) => {
        if (t.running) return t;
        const at = Date.now();
        return { ...t, running: true, startedAt: at, firstStartedAt: t.firstStartedAt ?? at };
      }),
    pause: () =>
      setTimer((t) =>
        t.running ? { ...t, running: false, accumulatedSeconds: elapsedSeconds(t, Date.now()) } : t,
      ),
    /** Stop early and keep the time actually spent. */
    finish: () => {
      const t = timerRef.current;
      if (!hasStarted(t)) return;
      processedRef.current = t.id;
      const session = sessionFromTimer(t, Date.now(), "finish");
      if (session) record(session);
      advance(t, t.phase === "focus" && session !== null);
    },
    /** Throw this phase away without saving anything. */
    discard: () =>
      setTimer((t) =>
        freshTimer(t.phase, configRef.current, { taskId: t.taskId, projectId: t.projectId }),
      ),
    /** Breaks only: go straight back to focus. */
    skipBreak: () =>
      setTimer((t) =>
        t.phase === "focus"
          ? t
          : freshTimer("focus", configRef.current, { taskId: t.taskId, projectId: t.projectId }),
      ),
    /** Choose the project before starting (no effect while a phase is under way). */
    setProject: (projectId: string | null, taskProject: (taskId: string) => string | null) =>
      setTimer((t) => {
        if (hasStarted(t)) return t;
        const keepTask = t.taskId !== null && taskProject(t.taskId) === projectId;
        return { ...t, projectId, taskId: keepTask ? t.taskId : null };
      }),
    /** Choose the task; a task that belongs to a project brings its project with it. */
    setTask: (taskId: string | null, projectOfTask: string | null) =>
      setTimer((t) => {
        if (hasStarted(t)) return t;
        return { ...t, taskId, projectId: taskId && projectOfTask ? projectOfTask : t.projectId };
      }),
    saveSettings: (next: FocusConfig) => {
      const clean = clampConfig(next);
      setConfig(clean);
      // An unstarted phase adopts the new length at once.
      setTimer((t) => (hasStarted(t) ? t : { ...t, plannedSeconds: phaseSeconds(t.phase, clean) }));
    },
  };
}
