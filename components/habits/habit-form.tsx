"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { updateHabit } from "@/features/habits/actions";
import type { Habit } from "@/features/habits/queries";
import type { ActionResult, FieldErrors } from "@/lib/action-result";
import { safeAction } from "@/lib/safe-action";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [7, "Sun"],
] as const;

type Area = { id: string; name: string; archived_at: string | null };

export type HabitDefaults = Pick<
  Habit,
  | "title"
  | "description"
  | "area_id"
  | "kind"
  | "target_value"
  | "unit"
  | "frequency"
  | "weekdays"
  | "times_per_week"
  | "starts_on"
  | "ends_on"
>;

/** A new habit: every day, from today. */
export function newHabitDefaults(today: string): HabitDefaults {
  return {
    title: "",
    description: null,
    area_id: null,
    kind: "boolean",
    target_value: null,
    unit: null,
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    times_per_week: null,
    starts_on: today,
    ends_on: null,
  };
}

/**
 * Name (when creating), what to track, schedule, area, dates, and notes: one short form shared by
 * the "New habit" sheet and the habit's own page. Reports success only after the server confirms.
 */
export function HabitForm({
  habit,
  areas,
  withTitle = false,
  submitLabel,
  onSubmit,
  onSaved,
  footer,
}: {
  habit: HabitDefaults;
  areas: Area[];
  /** Show the name field (creation). Existing habits are renamed from their title. */
  withTitle?: boolean;
  submitLabel: string;
  onSubmit: (input: Record<string, unknown>) => Promise<ActionResult<unknown>>;
  /** Called after the server confirmed the save. Return a status message, or nothing. */
  onSaved?: () => string | void;
  footer?: ReactNode;
}) {
  const id = useId();
  const [kind, setKind] = useState(habit.kind);
  const [frequency, setFrequency] = useState(habit.frequency);
  const [weekdays, setWeekdays] = useState<number[]>(habit.weekdays);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const err = (field: string) =>
    errors[field]?.length ? (
      <p className="text-xs text-danger">{errors[field]!.join(" ")}</p>
    ) : null;

  return (
    <form
      aria-label={withTitle ? "New habit" : "Habit settings"}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          setStatus(null);
          const result = await onSubmit({
            title: withTitle ? form.get("title") : habit.title,
            description: form.get("description"),
            area_id: form.get("area_id"),
            kind,
            target_value: form.get("target_value"),
            unit: form.get("unit"),
            frequency,
            weekdays,
            times_per_week: form.get("times_per_week"),
            starts_on: form.get("starts_on"),
            ends_on: form.get("ends_on"),
          });
          if (!result.ok) {
            setErrors(result.fieldErrors ?? {});
            setStatus({ tone: "error", text: result.error });
            return;
          }
          setErrors({});
          setStatus({ tone: "ok", text: onSaved?.() ?? "Saved" });
        });
      }}
    >
      {withTitle && (
        <div className="space-y-1">
          <label htmlFor={`${id}-title`} className="block text-sm font-medium">
            Name
          </label>
          <input
            id={`${id}-title`}
            name="title"
            required
            maxLength={200}
            autoFocus
            placeholder="e.g. Read 20 pages"
            defaultValue={habit.title}
            aria-invalid={errors.title?.length ? true : undefined}
            className={controlClass}
          />
          {err("title")}
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Track</legend>
        <div role="radiogroup" className="flex gap-0.5 rounded-md bg-surface-muted p-0.5 text-sm">
          {(
            [
              ["boolean", "Done / not done"],
              ["measurable", "An amount"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                "flex-1 rounded-[5px] px-3 py-1 font-medium transition-colors",
                kind === value
                  ? "bg-surface text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {kind === "measurable" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor={`${id}-target`} className="block text-sm">
                Daily target
              </label>
              <input
                id={`${id}-target`}
                name="target_value"
                type="number"
                min={0}
                step="any"
                defaultValue={habit.target_value ?? ""}
                className={controlClass}
              />
              {err("target_value")}
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-unit`} className="block text-sm">
                Unit (optional)
              </label>
              <input
                id={`${id}-unit`}
                name="unit"
                maxLength={30}
                placeholder="pages, minutes, km"
                defaultValue={habit.unit ?? ""}
                className={controlClass}
              />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Schedule</legend>
        <div role="radiogroup" className="flex gap-0.5 rounded-md bg-surface-muted p-0.5 text-sm">
          {(
            [
              ["daily", "On certain days"],
              ["weekly", "Times a week"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={frequency === value}
              onClick={() => setFrequency(value)}
              className={cn(
                "flex-1 rounded-[5px] px-3 py-1 font-medium transition-colors",
                frequency === value
                  ? "bg-surface text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {frequency === "daily" ? (
          <div>
            <div role="group" aria-label="Days" className="flex flex-wrap gap-1">
              {WEEKDAYS.map(([day, label]) => {
                const on = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setWeekdays((days) =>
                        on ? days.filter((d) => d !== day) : [...days, day].sort(),
                      )
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-sm",
                      on
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Other days are rest days and never break a streak.
            </p>
            {err("weekdays")}
          </div>
        ) : (
          <div className="space-y-1">
            <label htmlFor={`${id}-times`} className="block text-sm">
              Times per week
            </label>
            <select
              id={`${id}-times`}
              name="times_per_week"
              defaultValue={habit.times_per_week ?? 3}
              className={cn(controlClass, "w-auto")}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {err("times_per_week")}
          </div>
        )}
      </fieldset>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor={`${id}-area`} className="block text-sm">
            Life area
          </label>
          <select
            id={`${id}-area`}
            name="area_id"
            defaultValue={habit.area_id ?? ""}
            className={controlClass}
          >
            <option value="">None</option>
            {areas
              .filter((a) => !a.archived_at || a.id === habit.area_id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-starts`} className="block text-sm">
            Starts
          </label>
          <input
            id={`${id}-starts`}
            name="starts_on"
            type="date"
            required
            defaultValue={habit.starts_on}
            className={controlClass}
          />
          {err("starts_on")}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-ends`} className="block text-sm">
            Ends (optional)
          </label>
          <input
            id={`${id}-ends`}
            name="ends_on"
            type="date"
            defaultValue={habit.ends_on ?? ""}
            className={controlClass}
          />
          {err("ends_on")}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor={`${id}-description`} className="block text-sm">
          Notes (optional)
        </label>
        <textarea
          id={`${id}-description`}
          name="description"
          rows={2}
          maxLength={2000}
          defaultValue={habit.description ?? ""}
          className={controlClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "text-sm",
            status?.tone === "error" ? "text-danger" : "text-muted-foreground",
          )}
        >
          {status?.text}
        </span>
        {footer}
      </div>
    </form>
  );
}

/** The settings form on a habit's own page. */
export function HabitSettings({ habit, areas }: { habit: Habit; areas: Area[] }) {
  const router = useRouter();
  return (
    <HabitForm
      habit={habit}
      areas={areas}
      submitLabel="Save habit"
      onSubmit={(input) => safeAction(() => updateHabit(habit.id, input))}
      onSaved={() => router.refresh()}
    />
  );
}
