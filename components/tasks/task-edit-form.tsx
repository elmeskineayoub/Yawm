"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputField, SelectField, TextAreaField } from "@/components/ui/field";
import { SaveStatus } from "@/components/ui/save-status";
import { updateTask } from "@/features/tasks/actions";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/features/tasks/logic";
import type { Lookups, TaskRow } from "@/features/tasks/queries";
import { idleSaveState } from "@/lib/action-result";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function TaskEditForm({
  task,
  tagNames,
  lookups,
}: {
  task: TaskRow;
  tagNames: string[];
  lookups: Lookups;
}) {
  const [state, action, pending] = useActionState(updateTask.bind(null, task.id), idleSaveState);
  const [frequency, setFrequency] = useState(task.recurrence_frequency ?? "none");
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  const projectOptions = [
    { value: "", label: "No project" },
    ...lookups.projects
      .filter((p) => p.status !== "archived" || p.id === task.project_id)
      .map((p) => ({ value: p.id, label: p.name })),
  ];
  const areaOptions = [
    { value: "", label: "No area" },
    ...lookups.areas
      .filter((a) => !a.archived_at || a.id === task.area_id)
      .map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <form action={action} className="space-y-4" noValidate>
      <InputField
        label="Title"
        name="title"
        required
        maxLength={500}
        defaultValue={task.title}
        errors={errors?.title}
      />
      <TextAreaField
        label="Description and notes"
        name="description"
        maxLength={20000}
        rows={5}
        defaultValue={task.description ?? ""}
        errors={errors?.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Status"
          name="status"
          defaultValue={task.status}
          options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          errors={errors?.status}
        />
        <SelectField
          label="Priority"
          name="priority"
          defaultValue={task.priority}
          options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        />
        <InputField
          label="Due date"
          name="due_date"
          type="date"
          defaultValue={task.due_date ?? ""}
          hint="A deadline. Scheduling work into the calendar comes later."
          errors={errors?.due_date}
        />
        <InputField
          label="Due time (optional)"
          name="due_time"
          type="time"
          defaultValue={task.due_time?.slice(0, 5) ?? ""}
          errors={errors?.due_time}
        />
        <InputField
          label="Estimate (minutes)"
          name="estimate_minutes"
          type="number"
          min={1}
          max={10080}
          inputMode="numeric"
          defaultValue={task.estimate_minutes ?? ""}
          errors={errors?.estimate_minutes}
        />
        <InputField
          label="Tags"
          name="tags"
          defaultValue={tagNames.join(", ")}
          hint="Separate with commas. New tags are created automatically."
          list="tag-suggestions"
        />
        <datalist id="tag-suggestions">
          {lookups.tags.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
        <SelectField
          label="Project"
          name="project_id"
          defaultValue={task.project_id ?? ""}
          options={projectOptions}
          errors={errors?.project_id}
        />
        <SelectField
          label="Life area"
          name="area_id"
          defaultValue={task.area_id ?? ""}
          options={areaOptions}
          errors={errors?.area_id}
        />
      </div>

      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Repeat</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Frequency"
            name="recurrence_frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as typeof frequency)}
            options={[
              { value: "none", label: "Does not repeat" },
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
            errors={errors?.recurrence_frequency}
          />
          {frequency !== "none" && (
            <>
              <InputField
                label="Every"
                name="recurrence_interval"
                type="number"
                min={1}
                max={365}
                defaultValue={task.recurrence_interval}
                hint={frequency === "daily" ? "days" : frequency === "weekly" ? "weeks" : "months"}
                errors={errors?.recurrence_interval}
              />
              <InputField
                label="Ends (optional)"
                name="recurrence_until"
                type="date"
                defaultValue={task.recurrence_until ?? ""}
                errors={errors?.recurrence_until}
              />
            </>
          )}
        </div>
        {frequency === "weekly" && (
          <fieldset>
            <legend className="text-sm font-medium">On</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="recurrence_weekdays"
                    value={day.value}
                    defaultChecked={task.recurrence_weekdays?.includes(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty to repeat on the due date&apos;s weekday.
            </p>
          </fieldset>
        )}
        {frequency !== "none" && (
          <p className="text-xs text-muted-foreground">
            When you complete this task, the next one is created automatically.
          </p>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save changes
        </Button>
        <SaveStatus pending={pending} state={state} />
      </div>
    </form>
  );
}
