"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { Maximize2, Minimize2, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { Section } from "@/components/ui/section";
import { popoverClass } from "@/components/ui/surfaces";
import { Tooltip } from "@/components/ui/tooltip";
import {
  formatClock,
  formatDuration,
  PHASE_LABELS,
  type ProjectFocusTotals,
} from "@/features/focus/logic";
import type { RecentFocusSession } from "@/features/focus/queries";
import { cn } from "@/lib/utils";
import { FocusHistory } from "./focus-history";
import { FocusRing } from "./focus-ring";
import { FocusSettings } from "./focus-settings";
import type { FocusTaskOption } from "./focus-timer";
import { ProjectPicker, type PickerProject } from "./project-picker";
import { useFocusTimer, type FocusTimerApi } from "./use-focus-timer";

type Props = {
  projects: PickerProject[];
  tasks: FocusTaskOption[];
  totals: Record<string, ProjectFocusTotals>;
  /** False until the project column exists (migration not applied): project time isn't shown. */
  projectTrackingAvailable: boolean;
  today: { seconds: number; sessions: number };
  weekSeconds: number;
  recent: RecentFocusSession[];
  sessionProjects: Record<string, string>;
  timezone: string;
  /** From ?project=: preselect a project (only if no session is under way). */
  initialProjectId: string | null;
  /** From ?task=: preselect a task and its project (only if no session is under way). */
  initialTaskId?: string | null;
};

/**
 * The Focus workspace: a standard view inside the app, and an immersive view that covers the whole
 * screen with the timer at its centre. Both render from the same useFocusTimer engine, called once
 * here, so switching views never resets, pauses, or otherwise touches the running timer.
 */
export function FocusWorkspace(props: Props) {
  const projectNames = Object.fromEntries(props.projects.map((p) => [p.id, p.name]));
  const f = useFocusTimer({ projectNames });
  const [immersive, setImmersive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const taskProject = (taskId: string) =>
    props.tasks.find((t) => t.id === taskId)?.project_id ?? null;

  // Preselect a task or project from the link (e.g. "Start focus" on the Dashboard), once, if
  // nothing is running. A task brings its own project.
  const applied = useRef(false);
  const { mounted, started, setProject, setTask } = f;
  useEffect(() => {
    if (applied.current || !mounted || (!props.initialProjectId && !props.initialTaskId)) return;
    applied.current = true;
    if (started) return;
    if (props.initialTaskId) setTask(props.initialTaskId, taskProject(props.initialTaskId));
    else if (props.initialProjectId) setProject(props.initialProjectId, taskProject);
    // taskProject only reads props; running this once on mount is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, started, props.initialProjectId, props.initialTaskId]);

  const settings = (
    <Popover.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2 aria-hidden className="size-4" />
          Durations
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className={cn(popoverClass, "w-72 p-4")}
        >
          <h2 className="mb-3 text-sm font-semibold">Pomodoro durations</h2>
          <FocusSettings
            config={f.config}
            onSave={(next) => {
              f.saveSettings(next);
              setSettingsOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  return (
    <>
      <PageHeader
        title="Focus"
        description="Deep work, one session at a time. Time counts toward the project you choose."
        actions={
          <>
            {settings}
            <Button variant="outline" size="sm" onClick={() => setImmersive(true)}>
              <Maximize2 aria-hidden className="size-4" />
              Enter immersive mode
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Timer" className="flex min-w-0 flex-col items-center">
          <TimerFace
            f={f}
            projectNames={projectNames}
            tasks={props.tasks}
            size="min(18rem, 78vw)"
            clock="text-6xl"
          />
          <Controls f={f} />
          <div className="mt-8 grid w-full max-w-xl gap-4 sm:grid-cols-2">
            <ProjectPicker
              projects={props.projects}
              value={f.timer.projectId}
              disabled={f.started || f.timer.phase !== "focus"}
              onChange={(id) => f.setProject(id, taskProject)}
            />
            <TaskPicker f={f} tasks={props.tasks} />
          </div>
          <p className="mt-2 max-w-xl text-center text-xs text-muted-foreground" aria-live="polite">
            {f.timer.phase !== "focus"
              ? "Breaks are rest: they don't count toward any project."
              : f.started
                ? "The project and task are fixed while this session runs. Finish or discard it to change them."
                : "Choose before you start. You can finish early and keep the time you actually focused."}
          </p>
        </section>

        <aside aria-label="Focus time" className="min-w-0 space-y-8">
          <ProjectContext
            projectId={f.timer.projectId}
            projectNames={projectNames}
            totals={props.totals}
            available={props.projectTrackingAvailable}
          />
          <Section title="Today" variant="label" divider>
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Focused" value={formatDuration(props.today.seconds)} />
              <Stat label="Sessions" value={String(props.today.sessions)} />
              <Stat label="This week" value={formatDuration(props.weekSeconds)} />
            </dl>
            {f.pendingCount > 0 && (
              <p className="mt-2 text-xs text-warning" role="status">
                {f.pendingCount} session{f.pendingCount === 1 ? "" : "s"} waiting to be saved (kept
                on this device).
              </p>
            )}
          </Section>
          <Section title="Recent sessions" variant="label" divider>
            <FocusHistory
              sessions={props.recent}
              timezone={props.timezone}
              sessionProjects={props.sessionProjects}
              projectNames={projectNames}
            />
          </Section>
        </aside>
      </div>

      <Dialog.Root open={immersive} onOpenChange={setImmersive}>
        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-[70] flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] outline-none data-[state=open]:animate-[fade-in_200ms_ease-out]"
          >
            <Dialog.Title className="sr-only">Focus, immersive view</Dialog.Title>
            <div className="flex items-center justify-end gap-2 p-4">
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                <Kbd>Esc</Kbd> to exit
              </span>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  <Minimize2 aria-hidden className="size-4" />
                  Exit immersive mode
                </Button>
              </Dialog.Close>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
              <TimerFace
                f={f}
                projectNames={projectNames}
                tasks={props.tasks}
                size="min(72vmin, 30rem)"
                clock="text-[clamp(3.25rem,13vmin,6.5rem)]"
                large
              />
              <Controls f={f} immersive />
            </div>
            <p className="p-6 text-center text-xs text-muted-foreground">
              Today: {formatDuration(props.today.seconds)} focused · {props.today.sessions} session
              {props.today.sessions === 1 ? "" : "s"}
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function TimerFace({
  f,
  projectNames,
  tasks,
  size,
  clock,
  large = false,
}: {
  f: FocusTimerApi;
  projectNames: Record<string, string>;
  tasks: FocusTaskOption[];
  size: string;
  clock: string;
  large?: boolean;
}) {
  const { timer } = f;
  const project = timer.projectId ? projectNames[timer.projectId] : null;
  const task = timer.taskId ? tasks.find((t) => t.id === timer.taskId)?.title : null;
  return (
    <>
      <div
        role="progressbar"
        aria-label={`${PHASE_LABELS[timer.phase]} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(f.progress * 100)}
        aria-valuetext={`${formatClock(f.remaining)} remaining`}
      >
        <FocusRing
          progress={f.progress}
          size={size}
          stroke={large ? 3 : 4}
          tone={timer.phase === "focus" ? "accent" : "muted"}
        >
          <span className="label-caps">{PHASE_LABELS[timer.phase]}</span>
          <span
            className={cn(
              "mt-2 font-sans leading-none font-semibold tracking-tight tabular-nums",
              clock,
            )}
          >
            {f.mounted ? formatClock(f.remaining) : "--:--"}
          </span>
          <span className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            {f.status}
          </span>
        </FocusRing>
      </div>
      <p className={cn("mt-5 max-w-md text-center", large ? "font-serif text-xl" : "text-sm")}>
        {timer.phase !== "focus" ? (
          <span className="text-muted-foreground">Rest. The next focus session follows.</span>
        ) : project ? (
          <>
            <span className="text-muted-foreground">Toward </span>
            <span className="font-medium">{project}</span>
          </>
        ) : (
          <span className="text-muted-foreground">General focus</span>
        )}
      </p>
      {task && timer.phase === "focus" && (
        <p className="mt-1 max-w-md truncate text-center text-sm text-muted-foreground">{task}</p>
      )}
    </>
  );
}

function Controls({ f, immersive = false }: { f: FocusTimerApi; immersive?: boolean }) {
  const { timer } = f;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2",
        immersive ? "mt-8" : "mt-6",
      )}
    >
      {timer.running ? (
        <Button onClick={f.pause} className={immersive ? "min-w-28" : undefined}>
          Pause
        </Button>
      ) : (
        <Button
          onClick={f.start}
          disabled={!f.mounted}
          className={immersive ? "min-w-28" : undefined}
        >
          {f.started ? "Resume" : "Start"}
        </Button>
      )}
      {timer.phase === "focus" && f.started && (
        <>
          <Tooltip content="Stop now and save the time you actually focused">
            <Button variant="secondary" onClick={f.finish}>
              Finish session
            </Button>
          </Tooltip>
          <DiscardButton f={f} />
        </>
      )}
      {timer.phase !== "focus" && (
        <Button variant="ghost" onClick={f.skipBreak}>
          Skip break
        </Button>
      )}
    </div>
  );
}

/** Discard asks once when there is real time to lose (a minute or more); otherwise acts at once. */
function DiscardButton({ f }: { f: FocusTimerApi }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => (f.elapsed >= 60 ? setConfirming(true) : f.discard())}>
        Discard
      </Button>
    );
  }
  return (
    <span
      className="flex items-center gap-2 text-sm"
      role="group"
      aria-label="Discard this session?"
    >
      <span className="text-muted-foreground">Discard {formatDuration(f.elapsed)}?</span>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          f.discard();
          setConfirming(false);
        }}
      >
        Discard
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </span>
  );
}

function TaskPicker({ f, tasks }: { f: FocusTimerApi; tasks: FocusTaskOption[] }) {
  const id = useId();
  const projectId = f.timer.projectId;
  // With a project chosen, only its tasks; otherwise every open task (picking one brings its project).
  const options = projectId ? tasks.filter((t) => t.project_id === projectId) : tasks;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        Task (optional)
      </label>
      <select
        id={id}
        value={f.timer.taskId ?? ""}
        disabled={f.started || f.timer.phase !== "focus"}
        onChange={(e) => {
          const taskId = e.target.value || null;
          f.setTask(
            taskId,
            taskId ? (tasks.find((t) => t.id === taskId)?.project_id ?? null) : null,
          );
        }}
        className={cn(controlClass, "mt-1")}
      >
        <option value="">
          {options.length ? "No specific task" : "No open tasks in this project"}
        </option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProjectContext({
  projectId,
  projectNames,
  totals,
  available,
}: {
  projectId: string | null;
  projectNames: Record<string, string>;
  totals: Record<string, ProjectFocusTotals>;
  available: boolean;
}) {
  if (!projectId) {
    return (
      <Section title="Counts toward" variant="label">
        <p className="text-sm">General focus</p>
        <p className="mt-1 text-xs text-muted-foreground">Not counted toward any project.</p>
      </Section>
    );
  }
  const t = totals[projectId] ?? { todaySeconds: 0, weekSeconds: 0, totalSeconds: 0 };
  return (
    <Section
      title="Counts toward"
      variant="label"
      actions={
        <Link href={`/projects/${projectId}`} className="text-xs text-link">
          Open project
        </Link>
      }
    >
      <p className="font-serif text-lg">{projectNames[projectId] ?? "Project"}</p>
      {available ? (
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Today" value={formatDuration(t.todaySeconds)} />
          <Stat label="This week" value={formatDuration(t.weekSeconds)} />
          <Stat label="Total" value={formatDuration(t.totalSeconds)} />
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Project time appears once the database update (migration 20261107090000) is applied.
        </p>
      )}
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
