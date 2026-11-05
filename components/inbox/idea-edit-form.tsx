"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { InputField, SelectField, TextAreaField } from "@/components/ui/field";
import { SaveStatus } from "@/components/ui/save-status";
import { updateIdea } from "@/features/inbox/actions";
import { IDEA_STATUS_LABELS, type IdeaStatus } from "@/features/inbox/schemas";
import { idleSaveState, type SaveState } from "@/lib/action-result";

export function IdeaEditForm({
  idea,
  tagNames,
}: {
  idea: { id: string; title: string; body: string | null; status: IdeaStatus };
  tagNames: string[];
}) {
  // A save that never reaches the server is reported in the form, not sent to the error page.
  const [state, action, pending] = useActionState(
    async (previous: SaveState, formData: FormData): Promise<SaveState> => {
      try {
        return await updateIdea(idea.id, previous, formData);
      } catch {
        return {
          status: "error",
          message: "Couldn't reach the server, so this wasn't saved. Please try again.",
        };
      }
    },
    idleSaveState,
  );
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
