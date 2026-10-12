"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { logFocusSession } from "@/features/focus/actions";
import {
  clampConfig,
  DEFAULT_FOCUS_CONFIG,
  elapsedSeconds,
  formatClock,
  isComplete,
  nextPhase,
  phaseSeconds,
  PHASE_LABELS,
  remainingSeconds,
  type FocusConfig,
  type FocusPhase,
  type RunningTimer,
} from "@/features/focus/logic";
import { cn } from "@/lib/utils";

const CONFIG_KEY = "yawm.focus.config";
const TIMER_KEY = "yawm.focus.timer";
const CYCLE_KEY = "yawm.focus.cycle";

const newId = () => crypto.randomUUID();

function freshTimer(phase: FocusPhase, config: FocusConfig, taskId: string | null): RunningTimer {
  return {
    id: newId(),
    phase,
    taskId,
    plannedSeconds: phaseSeconds(phase, config),
    startedAt: 0,
    accumulatedSeconds: 0,
    running: false,
  };
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const subscribe = () => () => {};

export function FocusTimer({ tasks }: { tasks: { id: string; title: string }[] }) {
  const router = useRouter();
  // False during SSR and the first client render, true after mount: avoids a hydration mismatch
  // from values that only exist in localStorage.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const [config, setConfig] = useState<FocusConfig>(() =>
    clampConfig(read(CONFIG_KEY, DEFAULT_FOCUS_CONFIG)),
  );
  const [timer, setTimer] = useState<RunningTimer>(() => {
    const stored = read<RunningTimer | null>(TIMER_KEY, null);
    return stored ?? freshTimer("focus", clampConfig(read(CONFIG_KEY, DEFAULT_FOCUS_CONFIG)), null);
  });
  const [cycle, setCycle] = useState<number>(() => read(CYCLE_KEY, 0));
  const [now, setNow] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Latest values for the interval callback, which must not read state captured at setup time.
  const timerRef = useRef(timer);
  const configRef = useRef(config);
  const cycleRef = useRef(cycle);
  const processedRef = useRef<string | null>(null);
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    cycleRef.current = cycle;
  }, [cycle]);

  // Persist to localStorage so a reload recovers the running timer.
  useEffect(() => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);
  useEffect(() => {
    window.localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  }, [timer]);
  useEffect(() => {
    window.localStorage.setItem(CYCLE_KEY, JSON.stringify(cycle));
  }, [cycle]);

  const complete = useCallback(
    (t: RunningTimer) => {
      // The instant this phase's planned time is reached (may be in the past after a reload).
      const endMs = t.startedAt + (t.plannedSeconds - t.accumulatedSeconds) * 1000;
      const startMs = endMs - t.plannedSeconds * 1000;
      void logFocusSession({
        id: t.id,
        task_id: t.phase === "focus" ? t.taskId : null,
        session_type: t.phase,
        started_at: new Date(startMs).toISOString(),
        ended_at: new Date(endMs).toISOString(),
        duration_seconds: t.plannedSeconds,
      }).then((result) => {
        if (!result.ok) toast.error(result.error);
        else router.refresh();
      });
      const nextCount = t.phase === "focus" ? cycleRef.current + 1 : cycleRef.current;
      if (t.phase === "focus") setCycle(nextCount);
      setTimer(
        freshTimer(nextPhase(t.phase, nextCount, configRef.current), configRef.current, t.taskId),
      );
      toast.success(`${PHASE_LABELS[t.phase]} complete`);
    },
    [router],
  );

  // Repaint the countdown and detect completion from timestamps (not a long-lived counter).
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
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

  const remaining = mounted && now ? remainingSeconds(timer, now) : timer.plannedSeconds;
  const percent = timer.plannedSeconds
    ? Math.min(100, Math.round((1 - remaining / timer.plannedSeconds) * 100))
    : 0;
  const started = timer.running || timer.accumulatedSeconds > 0;
  const status = !mounted ? "" : timer.running ? "Running" : started ? "Paused" : "Ready";

  const start = () =>
    setTimer((t) => (t.running ? t : { ...t, running: true, startedAt: Date.now() }));
  const pause = () =>
    setTimer((t) =>
      t.running ? { ...t, running: false, accumulatedSeconds: elapsedSeconds(t, Date.now()) } : t,
    );
  const skip = () =>
    setTimer((t) =>
      freshTimer(nextPhase(t.phase, cycleRef.current, configRef.current), config, t.taskId),
    );
  const reset = () => setTimer((t) => freshTimer("focus", config, t.taskId));

  const saveSettings = (next: FocusConfig) => {
    const clean = clampConfig(next);
    setConfig(clean);
    setSettingsOpen(false);
    // If the current phase hasn't been started, adopt the new length immediately.
    setTimer((t) =>
      t.running || t.accumulatedSeconds > 0
        ? t
        : { ...t, plannedSeconds: phaseSeconds(t.phase, clean) },
    );
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            timer.phase === "focus"
              ? "bg-accent/15 text-accent"
              : "bg-surface-muted text-muted-foreground",
          )}
        >
          {PHASE_LABELS[timer.phase]}
        </span>
        <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {status}
        </span>
      </div>

      <p
        className="mt-4 text-center font-mono text-6xl font-semibold tabular-nums"
        aria-label={`${formatClock(remaining)} remaining`}
      >
        {mounted ? formatClock(remaining) : "--:--"}
      </p>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {timer.running ? (
          <Button onClick={pause}>Pause</Button>
        ) : (
          <Button onClick={start} disabled={!mounted}>
            {started ? "Resume" : "Start"}
          </Button>
        )}
        <Button variant="secondary" onClick={skip} disabled={!mounted}>
          Skip
        </Button>
        <Button variant="ghost" onClick={reset} disabled={!mounted || !started}>
          Reset
        </Button>
      </div>

      {timer.phase === "focus" && (
        <div className="mt-6">
          <label htmlFor="focus-task" className="block text-sm font-medium">
            Working on (optional)
          </label>
          <select
            id="focus-task"
            value={timer.taskId ?? ""}
            onChange={(e) => setTimer((t) => ({ ...t, taskId: e.target.value || null }))}
            className={cn(controlClass, "mt-1")}
          >
            <option value="">No task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-expanded={settingsOpen}
        >
          {settingsOpen ? "Hide durations" : "Durations"}
        </button>
        {settingsOpen && <SettingsForm config={config} onSave={saveSettings} />}
      </div>
    </div>
  );
}

function SettingsForm({
  config,
  onSave,
}: {
  config: FocusConfig;
  onSave: (config: FocusConfig) => void;
}) {
  const [draft, setDraft] = useState(config);
  const field = (key: keyof FocusConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: Number(e.target.value) }));

  const inputs: { key: keyof FocusConfig; label: string; min: number; max: number }[] = [
    { key: "focusMinutes", label: "Focus (min)", min: 1, max: 180 },
    { key: "shortBreakMinutes", label: "Short break (min)", min: 1, max: 60 },
    { key: "longBreakMinutes", label: "Long break (min)", min: 1, max: 120 },
    { key: "longBreakEvery", label: "Long break every", min: 2, max: 12 },
  ];

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {inputs.map(({ key, label, min, max }) => (
          <div key={key} className="space-y-1">
            <label
              htmlFor={`focus-${key}`}
              className="block text-xs font-medium text-muted-foreground"
            >
              {label}
            </label>
            <input
              id={`focus-${key}`}
              type="number"
              min={min}
              max={max}
              value={draft[key]}
              onChange={field(key)}
              className={cn(controlClass, "py-1.5")}
            />
          </div>
        ))}
      </div>
      <Button type="submit" variant="secondary" className="py-1.5">
        Save durations
      </Button>
    </form>
  );
}
