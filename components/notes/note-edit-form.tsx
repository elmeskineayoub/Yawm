"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { InputField, SelectField, TextAreaField } from "@/components/ui/field";
import { SaveStatus } from "@/components/ui/save-status";
import { updateNote } from "@/features/notes/actions";
import { idleSaveState } from "@/lib/action-result";

export type NoteLinkOptions = {
  projects: { id: string; name: string }[];
  goals: { id: string; title: string }[];
  tasks: { id: string; title: string }[];
};

export function NoteEditForm({
  note,
  tagNames,
  options,
}: {
  note: {
    id: string;
    title: string;
    body: string | null;
    project_id: string | null;
    goal_id: string | null;
    task_id: string | null;
  };
  tagNames: string[];
  options: NoteLinkOptions;
}) {
  const [state, action, pending] = useActionState(updateNote.bind(null, note.id), idleSaveState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <InputField
        label="Title"
        name="title"
        required
        maxLength={200}
        defaultValue={note.title}
        errors={errors?.title}
      />
      <TextAreaField
        label="Body"
        name="body"
        rows={12}
        maxLength={20000}
        defaultValue={note.body ?? ""}
        errors={errors?.body}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Project"
          name="project_id"
          defaultValue={note.project_id ?? ""}
          options={[
            { value: "", label: "No project" },
            ...options.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <SelectField
          label="Goal"
          name="goal_id"
          defaultValue={note.goal_id ?? ""}
          options={[
            { value: "", label: "No goal" },
            ...options.goals.map((g) => ({ value: g.id, label: g.title })),
          ]}
        />
        <SelectField
          label="Task"
          name="task_id"
          defaultValue={note.task_id ?? ""}
          options={[
            { value: "", label: "No task" },
            ...options.tasks.map((t) => ({ value: t.id, label: t.title })),
          ]}
        />
        <InputField
          label="Tags"
          name="tags"
          defaultValue={tagNames.join(", ")}
          hint="Separate with commas."
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save changes
        </Button>
        <SaveStatus pending={pending} state={state} />
      </div>
    </form>
  );
}
