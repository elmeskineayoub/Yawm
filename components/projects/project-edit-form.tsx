"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { InputField, SelectField, TextAreaField } from "@/components/ui/field";
import { SaveStatus } from "@/components/ui/save-status";
import { updateProject } from "@/features/projects/actions";
import type { ProjectRow } from "@/features/projects/queries";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/features/projects/schemas";
import { idleSaveState } from "@/lib/action-result";

export function ProjectEditForm({
  project,
  areas,
}: {
  project: ProjectRow;
  areas: { id: string; name: string; archived_at: string | null }[];
}) {
  const [state, action, pending] = useActionState(
    updateProject.bind(null, project.id),
    idleSaveState,
  );
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <InputField
        label="Name"
        name="name"
        required
        maxLength={200}
        defaultValue={project.name}
        errors={errors?.name}
      />
      <TextAreaField
        label="Outcome / description"
        name="description"
        rows={3}
        maxLength={5000}
        defaultValue={project.description ?? ""}
        errors={errors?.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Status"
          name="status"
          defaultValue={project.status}
          options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
        />
        <SelectField
          label="Life area"
          name="area_id"
          defaultValue={project.area_id ?? ""}
          options={[
            { value: "", label: "None" },
            ...areas
              .filter((a) => !a.archived_at || a.id === project.area_id)
              .map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        <InputField
          label="Start date"
          name="start_date"
          type="date"
          defaultValue={project.start_date ?? ""}
          errors={errors?.start_date}
        />
        <InputField
          label="Due date"
          name="due_date"
          type="date"
          defaultValue={project.due_date ?? ""}
          errors={errors?.due_date}
        />
      </div>
      <TextAreaField
        label="Notes"
        name="notes"
        rows={6}
        maxLength={20000}
        defaultValue={project.notes ?? ""}
        errors={errors?.notes}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save changes
        </Button>
        <SaveStatus pending={pending} state={state} />
      </div>
    </form>
  );
}
