"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { controlClass } from "@/components/ui/field";
import { InlineEdit } from "@/components/ui/inline-edit";
import {
  deleteGoal,
  saveGoalDetails,
  saveGoalText,
  setGoalCurrent,
  setGoalStatus,
} from "@/features/goals/actions";
import { GOAL_STATUSES, type GoalStatus } from "@/features/goals/logic";
import type { Goal } from "@/features/goals/queries";
import type { FieldErrors } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type Area = { id: string; name: string; archived_at: string | null };

export function GoalTextField({
  goalId,
  field,
  value,
  label,
  placeholder,
  multiline,
  maxLength,
}: {
  goalId: string;
  field: "title" | "why" | "description";
  value: string | null;
  label: string;
  placeholder: string;
  multiline?: boolean;
  maxLength: number;
}) {
  return (
    <InlineEdit
      value={value}
      label={label}
      placeholder={placeholder}
      maxLength={maxLength}
      {...(multiline ? { multiline } : {})}
      onSave={async (next) => {
        const result = await saveGoalText(goalId, field, next);
        return result.ok ? null : result.error;
      }}
    />
  );
}

/** Status saves as soon as it changes. */
export function GoalStatusSelect({ goalId, status }: { goalId: string; status: GoalStatus }) {
  const id = useId();
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        Status
      </label>
      <select
        id={id}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as GoalStatus;
          const previous = value;
          setValue(next);
          startTransition(async () => {
            const result = await setGoalStatus(goalId, next);
            if (!result.ok) {
              setValue(previous);
              toast.error(result.error);
            } else toast.success(`Goal marked ${next}`);
          });
        }}
        className={cn(controlClass, "w-auto py-1")}
      >
        {GOAL_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Quick update of the measurable target, e.g. books read so far. */
export function GoalCurrentValue({
  goalId,
  current,
  target,
  unit,
}: {
  goalId: string;
  current: number | null;
  target: number;
  unit: string | null;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(current ?? 0));
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const value = Number(draft);
        if (draft.trim() === "" || !Number.isFinite(value) || value < 0) {
          setStatus("Use 0 or more.");
          return;
        }
        startTransition(async () => {
          setStatus("Saving…");
          const result = await setGoalCurrent(goalId, value);
          setStatus(result.ok ? "Saved" : result.error);
        });
      }}
    >
      <label htmlFor={id} className="text-sm">
        Progress
      </label>
      <input
        id={id}
        type="number"
        min={0}
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={cn(controlClass, "w-28 py-1")}
      />
      <span className="text-sm text-muted-foreground">
        of {target}
        {unit ? ` ${unit}` : ""}
      </span>
      <Button type="submit" variant="secondary" className="py-1" disabled={pending}>
        Update
      </Button>
      <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </span>
    </form>
  );
}

/** Life area, dates, and the optional measurable target, saved together. */
export function GoalDetailsForm({ goal, areas }: { goal: Goal; areas: Area[] }) {
  const id = useId();
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const err = (field: string) =>
    errors[field]?.length ? (
      <p className="text-xs text-red-700 dark:text-red-400">{errors[field]!.join(" ")}</p>
    ) : null;

  return (
    <form
      aria-label="Goal details"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          setStatus(null);
          const result = await saveGoalDetails(goal.id, Object.fromEntries(form));
          if (!result.ok) {
            setErrors(result.fieldErrors ?? {});
            setStatus({ tone: "error", text: result.error });
            return;
          }
          setErrors({});
          setStatus({ tone: "ok", text: "Saved" });
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label htmlFor={`${id}-area`} className="block text-sm">
            Life area
          </label>
          <select
            id={`${id}-area`}
            name="area_id"
            defaultValue={goal.area_id ?? ""}
            className={controlClass}
          >
            <option value="">None</option>
            {areas
              .filter((a) => !a.archived_at || a.id === goal.area_id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-start`} className="block text-sm">
            Start
          </label>
          <input
            id={`${id}-start`}
            name="start_date"
            type="date"
            defaultValue={goal.start_date ?? ""}
            className={controlClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-target-date`} className="block text-sm">
            Target date
          </label>
          <input
            id={`${id}-target-date`}
            name="target_date"
            type="date"
            defaultValue={goal.target_date ?? ""}
            className={controlClass}
          />
          {err("target_date")}
        </div>
      </div>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1 text-sm font-medium">Measurable target (optional)</legend>
        <div className="space-y-1">
          <label htmlFor={`${id}-target`} className="block text-sm">
            Target
          </label>
          <input
            id={`${id}-target`}
            name="target_value"
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 24"
            defaultValue={goal.target_value ?? ""}
            className={controlClass}
          />
          {err("target_value")}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-current`} className="block text-sm">
            Current
          </label>
          <input
            id={`${id}-current`}
            name="current_value"
            type="number"
            min={0}
            step="any"
            defaultValue={goal.current_value ?? ""}
            className={controlClass}
          />
          {err("current_value")}
        </div>
        <div className="col-span-2 space-y-1">
          <label htmlFor={`${id}-unit`} className="block text-sm">
            Unit
          </label>
          <input
            id={`${id}-unit`}
            name="unit"
            maxLength={30}
            placeholder="books, km, €"
            defaultValue={goal.unit ?? ""}
            className={controlClass}
          />
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Button>
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "text-sm",
            status?.tone === "error" ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {status?.text}
        </span>
      </div>
    </form>
  );
}

export function DeleteGoalButton({ goalId, title }: { goalId: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost">Delete goal</Button>}
      title={`Delete “${title}”?`}
      description={
        <p>
          Its milestones are deleted. Linked projects, tasks, and vision cards are kept and simply
          unlinked. To keep it for the record, set its status to Archived instead.
        </p>
      }
      confirmLabel="Delete goal"
      onConfirm={async () => {
        const result = await deleteGoal(goalId);
        if (!result.ok) return result.error;
        toast.success("Goal deleted");
        router.push("/goals");
        return null;
      }}
    />
  );
}
