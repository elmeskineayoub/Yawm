"use client";

import { AlertCircle, Check } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { controlClass } from "@/components/ui/field";
import { linkToGoal } from "@/features/goals/actions";
import { setTaskTags, updateTaskFields } from "@/features/tasks/actions";
import type { TaskPatch } from "@/features/tasks/patch";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/features/tasks/logic";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * The task detail edits in place: each field saves on its own (on change for pickers, on blur or
 * Enter for text). One status line for the whole task reports Saving…, then Saved only after the
 * server confirmed every pending change; a rejected change rolls its field back and says why.
 */

type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "error"; message: string };

type SaveContext = {
  /** Runs a server write and tracks it in the shared status. Resolves to the error, or null. */
  run: (write: () => Promise<ActionResult>) => Promise<string | null>;
  status: SaveStatus;
};
const Ctx = createContext<SaveContext | null>(null);

function useSave(): SaveContext {
  const value = useContext(Ctx);
  if (!value) throw new Error("Task fields must be inside TaskSaveProvider.");
  return value;
}

export function TaskSaveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SaveStatus>({ state: "idle" });
  const pending = useRef(0);
  const lastError = useRef<string | null>(null);

  const run = useCallback(async (write: () => Promise<ActionResult>) => {
    pending.current += 1;
    lastError.current = null;
    setStatus({ state: "saving" });
    let error: string | null;
    try {
      const result = await write();
      error = result.ok ? null : result.error;
    } catch {
      error =
        typeof navigator !== "undefined" && !navigator.onLine
          ? "You're offline. This change wasn't saved."
          : "Couldn't reach the server. This change wasn't saved.";
    }
    pending.current -= 1;
    if (error) lastError.current = error;
    // Report "Saved" only once nothing is in flight and nothing failed.
    if (pending.current === 0) {
      setStatus(
        lastError.current ? { state: "error", message: lastError.current } : { state: "saved" },
      );
    }
    return error;
  }, []);

  const value = useMemo(() => ({ run, status }), [run, status]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The task's save state, announced politely to screen readers. */
export function TaskSaveIndicator({ className }: { className?: string }) {
  const { status } = useSave();
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        status.state === "error" ? "text-danger" : "text-muted-foreground",
        className,
      )}
    >
      {status.state === "saving" && "Saving…"}
      {status.state === "saved" && (
        <>
          <Check aria-hidden className="size-3.5" />
          Saved
        </>
      )}
      {status.state === "error" && (
        <>
          <AlertCircle aria-hidden className="size-3.5" />
          Not saved
        </>
      )}
    </span>
  );
}

/**
 * A field's local value plus the last value the server confirmed. Both follow the server value
 * whenever it changes (e.g. a refresh after another save) without remounting, so typing in one
 * field is never lost when another field's save completes. Comparing against the confirmed value
 * (not the last render) means a change made before the refresh lands is still saved.
 */
function useCommitted<T>(server: T, same: (a: T, b: T) => boolean = Object.is) {
  const [value, setValue] = useState(server);
  const [committed, setCommitted] = useState(server);
  const [seen, setSeen] = useState(server);
  if (!same(server, seen)) {
    setSeen(server);
    setValue(server);
    setCommitted(server);
  }
  const [error, setError] = useState<string | null>(null);
  const { run } = useSave();
  /** Saves `next` with `write` unless it is what the server already has. */
  const commit = async (next: T, write: (next: T) => Promise<ActionResult>) => {
    setValue(next);
    if (same(next, committed)) return;
    const failure = await run(() => write(next));
    setError(failure);
    if (failure) setValue(committed);
    else setCommitted(next);
  };
  return { value, setValue, commit, error };
}

function useField<T>(server: T, toPatch: (value: T) => TaskPatch, taskId: string) {
  const field = useCommitted(server);
  return {
    ...field,
    commit: (next: T) => field.commit(next, (v) => updateTaskFields(taskId, toPatch(v))),
  };
}

function FieldError({ id, error }: { id: string; error: string | null }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-danger">
      {error}
    </p>
  );
}

/** A property row: label on the left (top on phones), control on the right. */
function Property({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <label htmlFor={htmlFor} className="pt-2 text-sm text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const compact = cn(controlClass, "py-1.5");

export function TaskTitleField({
  taskId,
  title,
  className,
}: {
  taskId: string;
  title: string;
  className?: string;
}) {
  const id = useId();
  const field = useField(title, (v) => ({ title: v }), taskId);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        Title
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={1}
        maxLength={500}
        value={field.value}
        onChange={(e) => field.setValue(e.target.value.replace(/\n/g, ""))}
        onBlur={() => {
          const next = field.value.trim();
          if (next === "") field.setValue(title);
          else void field.commit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            ref.current?.blur();
          } else if (e.key === "Escape") {
            field.setValue(title);
          }
        }}
        aria-invalid={field.error ? true : undefined}
        aria-describedby={field.error ? `${id}-error` : undefined}
        className={cn(
          "field-sizing-content block w-full resize-none rounded-md bg-transparent px-1 -mx-1 outline-none hover:bg-surface-muted focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-accent/30",
          className,
        )}
      />
      <FieldError id={`${id}-error`} error={field.error} />
    </div>
  );
}

export function TaskDescriptionField({
  taskId,
  description,
}: {
  taskId: string;
  description: string | null;
}) {
  const id = useId();
  const field = useField(description ?? "", (v) => ({ description: v }), taskId);
  return (
    <div>
      <label htmlFor={id} className="label-caps">
        Description and notes
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={20000}
        value={field.value}
        placeholder="Add notes, links, or the next step…"
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => void field.commit(field.value)}
        aria-describedby={field.error ? `${id}-error` : undefined}
        className={cn(
          controlClass,
          "mt-1.5 field-sizing-content min-h-20 border-border bg-transparent",
        )}
      />
      <FieldError id={`${id}-error`} error={field.error} />
    </div>
  );
}

type Option = { value: string; label: string };

function SelectProperty({
  taskId,
  label,
  value: server,
  options,
  toPatch,
}: {
  taskId: string;
  label: string;
  value: string;
  options: Option[];
  toPatch: (value: string) => TaskPatch;
}) {
  const id = useId();
  const field = useField(server, toPatch, taskId);
  return (
    <Property label={label} htmlFor={id}>
      <select
        id={id}
        value={field.value}
        onChange={(e) => void field.commit(e.target.value)}
        aria-describedby={field.error ? `${id}-error` : undefined}
        className={compact}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} error={field.error} />
    </Property>
  );
}

export type TaskPropertiesProps = {
  taskId: string;
  status: string;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  estimateMinutes: number | null;
  projectId: string | null;
  areaId: string | null;
  goalId: string | null;
  tagNames: string[];
  projects: { id: string; name: string; status: string }[];
  areas: { id: string; name: string; archived_at: string | null }[];
  goals: { id: string; title: string }[];
  tagSuggestions: string[];
  /** Subtasks cannot belong to a goal directly; hidden for them. */
  showGoal: boolean;
};

export function TaskProperties(props: TaskPropertiesProps) {
  const { taskId } = props;
  const dueId = useId();
  const timeId = useId();
  const estimateId = useId();
  const goalId = useId();
  const tagsId = useId();

  const due = useField(props.dueDate ?? "", (v) => ({ due_date: v }), taskId);
  const time = useField(props.dueTime?.slice(0, 5) ?? "", (v) => ({ due_time: v }), taskId);
  const estimate = useField(
    props.estimateMinutes?.toString() ?? "",
    (v) => ({ estimate_minutes: v }),
    taskId,
  );

  const goal = useCommitted(props.goalId ?? "");
  const tags = useCommitted(props.tagNames.join(", "), (a, b) => a.trim() === b.trim());

  const projectOptions: Option[] = [
    { value: "", label: "No project" },
    ...props.projects
      .filter((p) => p.status !== "archived" || p.id === props.projectId)
      .map((p) => ({ value: p.id, label: p.name })),
  ];
  const areaOptions: Option[] = [
    { value: "", label: "No area" },
    ...props.areas
      .filter((a) => !a.archived_at || a.id === props.areaId)
      .map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <div className="space-y-2.5">
      <SelectProperty
        taskId={taskId}
        label="Status"
        value={props.status}
        options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        toPatch={(v) => ({ status: v })}
      />
      <SelectProperty
        taskId={taskId}
        label="Priority"
        value={props.priority}
        options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        toPatch={(v) => ({ priority: v })}
      />
      <Property label="Due date" htmlFor={dueId}>
        <div className="flex flex-wrap gap-2">
          <input
            id={dueId}
            type="date"
            value={due.value}
            onChange={(e) => void due.commit(e.target.value)}
            aria-describedby={`${dueId}-hint${due.error ? ` ${dueId}-error` : ""}`}
            className={cn(compact, "w-auto")}
          />
          <label htmlFor={timeId} className="sr-only">
            Due time (optional)
          </label>
          <input
            id={timeId}
            type="time"
            value={time.value}
            disabled={!due.value}
            onChange={(e) => time.setValue(e.target.value)}
            onBlur={() => void time.commit(time.value)}
            aria-describedby={time.error ? `${timeId}-error` : undefined}
            className={cn(compact, "w-auto")}
          />
        </div>
        <p id={`${dueId}-hint`} className="mt-1 text-xs text-muted-foreground">
          The deadline. Time to work on it is scheduled in the Planner.
        </p>
        <FieldError id={`${dueId}-error`} error={due.error} />
        <FieldError id={`${timeId}-error`} error={time.error} />
      </Property>
      <Property label="Estimate" htmlFor={estimateId}>
        <div className="flex items-center gap-2">
          <input
            id={estimateId}
            type="number"
            inputMode="numeric"
            min={1}
            max={10080}
            value={estimate.value}
            placeholder="—"
            onChange={(e) => estimate.setValue(e.target.value)}
            onBlur={() => void estimate.commit(estimate.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-describedby={estimate.error ? `${estimateId}-error` : undefined}
            className={cn(compact, "w-24")}
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
        <FieldError id={`${estimateId}-error`} error={estimate.error} />
      </Property>
      <SelectProperty
        taskId={taskId}
        label="Project"
        value={props.projectId ?? ""}
        options={projectOptions}
        toPatch={(v) => ({ project_id: v })}
      />
      <SelectProperty
        taskId={taskId}
        label="Life area"
        value={props.areaId ?? ""}
        options={areaOptions}
        toPatch={(v) => ({ area_id: v })}
      />
      {props.showGoal && (
        <Property label="Goal" htmlFor={goalId}>
          <select
            id={goalId}
            value={goal.value}
            onChange={(e) =>
              void goal.commit(e.target.value, (next) => linkToGoal("task", taskId, next || null))
            }
            aria-describedby={goal.error ? `${goalId}-error` : undefined}
            className={compact}
          >
            <option value="">No goal</option>
            {props.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <FieldError id={`${goalId}-error`} error={goal.error} />
        </Property>
      )}
      <Property label="Tags" htmlFor={tagsId}>
        <input
          id={tagsId}
          value={tags.value}
          list={`${tagsId}-suggestions`}
          placeholder="Separate with commas"
          onChange={(e) => tags.setValue(e.target.value)}
          onBlur={() => void tags.commit(tags.value, (next) => setTaskTags(taskId, next))}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-describedby={tags.error ? `${tagsId}-error` : undefined}
          className={compact}
        />
        <datalist id={`${tagsId}-suggestions`}>
          {props.tagSuggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <FieldError id={`${tagsId}-error`} error={tags.error} />
      </Property>
    </div>
  );
}

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/** Repeat rule. Saves on each change, as one validated unit (frequency, interval, days, end). */
export function TaskRepeatField({
  taskId,
  frequency,
  interval,
  weekdays,
  until,
  hasDueDate,
}: {
  taskId: string;
  frequency: string | null;
  interval: number;
  weekdays: number[] | null;
  until: string | null;
  hasDueDate: boolean;
}) {
  const id = useId();
  const server = useMemo(
    () => ({
      frequency: frequency ?? "none",
      interval: String(interval),
      weekdays: (weekdays ?? []).map(String).sort(),
      until: until ?? "",
    }),
    [frequency, interval, weekdays, until],
  );
  const field = useCommitted(server, (a, b) => JSON.stringify(a) === JSON.stringify(b));
  const rule = field.value;
  const setRule = field.setValue;
  const error = field.error;
  const save = (next: typeof rule) =>
    field.commit(next, (r) =>
      updateTaskFields(taskId, {
        recurrence_frequency: r.frequency,
        recurrence_interval: r.interval,
        recurrence_weekdays: r.weekdays,
        recurrence_until: r.until,
      }),
    );

  const unit =
    rule.frequency === "daily" ? "days" : rule.frequency === "weekly" ? "weeks" : "months";
  return (
    <fieldset className="space-y-2.5">
      <legend className="label-caps mb-2">Repeat</legend>
      <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
        <label htmlFor={`${id}-freq`} className="pt-2 text-sm text-muted-foreground">
          Frequency
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            id={`${id}-freq`}
            value={rule.frequency}
            onChange={(e) => void save({ ...rule, frequency: e.target.value })}
            aria-describedby={`${id}-help`}
            className={cn(compact, "w-auto")}
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          {rule.frequency !== "none" && (
            <>
              <label htmlFor={`${id}-interval`} className="text-sm text-muted-foreground">
                every
              </label>
              <input
                id={`${id}-interval`}
                type="number"
                min={1}
                max={365}
                value={rule.interval}
                onChange={(e) => setRule({ ...rule, interval: e.target.value })}
                onBlur={() => void save(rule)}
                className={cn(compact, "w-20")}
              />
              <span className="text-sm text-muted-foreground">{unit}</span>
            </>
          )}
        </div>
      </div>
      {rule.frequency === "weekly" && (
        <fieldset className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
          <legend className="sr-only">On these days</legend>
          <span aria-hidden className="pt-1 text-sm text-muted-foreground">
            On
          </span>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((day) => {
              const on = rule.weekdays.includes(String(day.value));
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    void save({
                      ...rule,
                      weekdays: on
                        ? rule.weekdays.filter((d) => d !== String(day.value))
                        : [...rule.weekdays, String(day.value)].sort(),
                    })
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    on
                      ? "border-accent bg-accent-soft font-medium text-accent"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {rule.frequency !== "none" && (
        <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
          <label htmlFor={`${id}-until`} className="pt-2 text-sm text-muted-foreground">
            Ends (optional)
          </label>
          <input
            id={`${id}-until`}
            type="date"
            value={rule.until}
            onChange={(e) => void save({ ...rule, until: e.target.value })}
            className={cn(compact, "w-auto justify-self-start")}
          />
        </div>
      )}
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {!hasDueDate
          ? "Set a due date first: a repeating task repeats from its due date."
          : rule.frequency === "weekly" && rule.weekdays.length === 0
            ? "Repeats on the due date's weekday. Pick days to change that."
            : rule.frequency !== "none"
              ? "When you complete it, the next one is created automatically."
              : ""}
      </p>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
