"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { formatClock, PHASE_LABELS } from "@/features/focus/logic";
import { cn } from "@/lib/utils";
import { FocusRing } from "./focus-ring";
import { useFocusTimer } from "./use-focus-timer";

export type FocusTaskOption = { id: string; title: string; project_id: string | null };

/**
 * The compact timer embedded on Today. Same engine as the Focus page (useFocusTimer): the task
 * picked here brings its project, and the full Focus page offers project-only focus and immersive
 * mode.
 */
export function FocusTimer({
  tasks,
  projectNames = {},
}: {
  tasks: FocusTaskOption[];
  projectNames?: Record<string, string>;
}) {
  const id = useId();
  const f = useFocusTimer({ projectNames });
  const { timer } = f;
  const projectOf = (taskId: string) => tasks.find((t) => t.id === taskId)?.project_id ?? null;
  const project = timer.projectId ? projectNames[timer.projectId] : null;

  return (
    <div className="flex flex-col items-center">
      <FocusRing
        progress={f.progress}
        size="11rem"
        stroke={5}
        tone={timer.phase === "focus" ? "accent" : "muted"}
      >
        <span className="label-caps">{PHASE_LABELS[timer.phase]}</span>
        <span
          className="mt-1 font-sans text-4xl font-semibold tracking-tight tabular-nums"
          aria-label={`${formatClock(f.remaining)} remaining`}
        >
          {f.mounted ? formatClock(f.remaining) : "--:--"}
        </span>
        <span className="mt-1 text-xs text-muted-foreground" role="status" aria-live="polite">
          {f.status}
        </span>
      </FocusRing>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {timer.running ? (
          <Button size="sm" onClick={f.pause}>
            Pause
          </Button>
        ) : (
          <Button size="sm" onClick={f.start} disabled={!f.mounted}>
            {f.started ? "Resume" : "Start"}
          </Button>
        )}
        {f.started && timer.phase === "focus" && (
          <>
            <Button size="sm" variant="secondary" onClick={f.finish}>
              Finish
            </Button>
            <Button size="sm" variant="ghost" onClick={f.discard}>
              Discard
            </Button>
          </>
        )}
        {timer.phase !== "focus" && (
          <Button size="sm" variant="ghost" onClick={f.skipBreak}>
            Skip break
          </Button>
        )}
      </div>

      {timer.phase === "focus" && (
        <div className="mt-4 w-full">
          <label htmlFor={id} className="block text-sm font-medium">
            Working on (optional)
          </label>
          <select
            id={id}
            value={timer.taskId ?? ""}
            disabled={f.started}
            onChange={(e) => {
              const taskId = e.target.value || null;
              f.setTask(taskId, taskId ? projectOf(taskId) : null);
            }}
            className={cn(controlClass, "mt-1")}
          >
            <option value="">No task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {f.started
              ? "Fixed while this session runs. Finish or discard it to change."
              : project
                ? `Counts toward ${project}.`
                : "Choose a project and more on the Focus page."}
          </p>
        </div>
      )}
    </div>
  );
}
