"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { InputField, SelectField, TextAreaField } from "@/components/ui/field";
import { SaveStatus } from "@/components/ui/save-status";
import { updateIdea } from "@/features/inbox/actions";
import { IDEA_STATUS_LABELS, type IdeaStatus } from "@/features/inbox/schemas";
import { idleSaveState } from "@/lib/action-result";

export function IdeaEditForm({
  idea,
  tagNames,
}: {
  idea: { id: string; title: string; body: string | null; status: IdeaStatus };
  tagNames: string[];
}) {
  const [state, action, pending] = useActionState(updateIdea.bind(null, idea.id), idleSaveState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <InputField
        label="Idea"
        name="title"
        required
        maxLength={500}
        defaultValue={idea.title}
        errors={errors?.title}
      />
      <TextAreaField
        label="Details"
        name="body"
        rows={8}
        maxLength={20000}
        defaultValue={idea.body ?? ""}
        errors={errors?.body}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Status"
          name="status"
          defaultValue={idea.status}
          options={(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((s) => ({
            value: s,
            label: IDEA_STATUS_LABELS[s],
          }))}
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
