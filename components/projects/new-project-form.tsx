"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputField, SelectField } from "@/components/ui/field";
import { createProject } from "@/features/projects/actions";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/features/projects/schemas";
import type { FieldErrors } from "@/lib/action-result";

export function NewProjectForm({ areas }: { areas: { id: string; name: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors | undefined>();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      noValidate
      className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
      action={(formData) =>
        startTransition(async () => {
          const result = await createProject(formData);
          if (result.ok) {
            formRef.current?.reset();
            setErrors(undefined);
            setMessage(null);
            toast.success("Project created");
            router.push(`/projects/${result.data.id}`);
          } else {
            setErrors(result.fieldErrors);
            setMessage(result.error);
          }
        })
      }
    >
      <InputField label="New project" name="name" required maxLength={200} errors={errors?.name} />
      <SelectField
        label="Life area"
        name="area_id"
        options={[
          { value: "", label: "None" },
          ...areas.map((a) => ({ value: a.id, label: a.name })),
        ]}
      />
      <SelectField
        label="Status"
        name="status"
        defaultValue="active"
        options={PROJECT_STATUSES.filter((s) => s !== "archived").map((s) => ({
          value: s,
          label: PROJECT_STATUS_LABELS[s],
        }))}
      />
      <InputField label="Due date" name="due_date" type="date" errors={errors?.due_date} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create"}
      </Button>
      {message && !errors && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-400">
          {message}
        </p>
      )}
    </form>
  );
}
