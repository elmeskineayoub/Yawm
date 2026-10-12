"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { controlClass } from "@/components/ui/field";
import {
  createArea,
  deleteArea,
  moveArea,
  setAreaArchived,
  updateArea,
} from "@/features/areas/actions";
import { cn } from "@/lib/utils";

type Area = {
  id: string;
  name: string;
  color: string;
  archived_at: string | null;
  usage: number;
};

function AreaRow({ area, isFirst, isLast }: { area: Area; isFirst: boolean; isLast: boolean }) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const archived = Boolean(area.archived_at);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setError(null);
        if (success) toast.success(success);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });

  return (
    <li className={cn("space-y-1 py-3", archived && "opacity-70")}>
      <form
        className="flex flex-wrap items-center gap-2"
        action={(formData) => run(() => updateArea(area.id, formData), "Area saved")}
      >
        <label htmlFor={`${id}-color`} className="sr-only">
          Color for {area.name}
        </label>
        <input
          id={`${id}-color`}
          type="color"
          name="color"
          defaultValue={area.color}
          className="h-9 w-10 cursor-pointer rounded border border-border bg-background"
        />
        <label htmlFor={`${id}-name`} className="sr-only">
          Name of {area.name}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          defaultValue={area.name}
          required
          maxLength={50}
          aria-invalid={error ? true : undefined}
          className={cn(controlClass, "w-auto min-w-0 flex-1 basis-32")}
        />
        <Button type="submit" variant="secondary" className="px-3 py-1.5" disabled={pending}>
          Save
        </Button>
        <Button
          variant="ghost"
          className="px-2 py-1.5"
          disabled={pending || isFirst}
          aria-label={`Move ${area.name} up`}
          onClick={() => run(() => moveArea(area.id, "up"))}
        >
          <ArrowUp aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          className="px-2 py-1.5"
          disabled={pending || isLast}
          aria-label={`Move ${area.name} down`}
          onClick={() => run(() => moveArea(area.id, "down"))}
        >
          <ArrowDown aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          className="px-2 py-1.5 text-xs"
          disabled={pending}
          onClick={() =>
            run(
              () => setAreaArchived(area.id, !archived),
              archived ? "Area restored" : "Area archived",
            )
          }
        >
          {archived ? "Restore" : "Archive"}
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              className="px-2 py-1.5 text-xs"
              aria-label={`Delete ${area.name}`}
            >
              Delete
            </Button>
          }
          title={`Delete “${area.name}”?`}
          description={
            <p>
              {area.usage > 0
                ? `It is used by ${area.usage} task${area.usage === 1 ? "" : "s"}. `
                : ""}
              Tasks and projects using it are kept, but will no longer have an area. Archiving hides
              it from pickers without changing anything.
            </p>
          }
          confirmLabel="Delete"
          onConfirm={async () => {
            const result = await deleteArea(area.id);
            return result.ok ? null : result.error;
          }}
        />
      </form>
      {archived && <p className="text-xs text-muted-foreground">Archived</p>}
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}

export function AreasManager({ areas }: { areas: Area[] }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <ul className="divide-y divide-border">
        {areas.map((area, index) => (
          <AreaRow
            key={area.id}
            area={area}
            isFirst={index === 0}
            isLast={index === areas.length - 1}
          />
        ))}
      </ul>
      <form
        ref={formRef}
        className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-4"
        action={(formData) =>
          startTransition(async () => {
            const result = await createArea(formData);
            if (result.ok) {
              setError(null);
              formRef.current?.reset();
              toast.success("Area added");
            } else {
              setError(result.fieldErrors?.name?.[0] ?? result.error);
            }
          })
        }
      >
        <label htmlFor={`${id}-color`} className="sr-only">
          Color for new area
        </label>
        <input
          id={`${id}-color`}
          type="color"
          name="color"
          defaultValue="#64748b"
          className="h-9 w-10 cursor-pointer rounded border border-border bg-background"
        />
        <label htmlFor={`${id}-name`} className="sr-only">
          New area name
        </label>
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={50}
          placeholder="Add a custom area"
          className={cn(controlClass, "w-auto min-w-0 flex-1 basis-40")}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add area"}
        </Button>
        {error && (
          <p role="alert" className="w-full text-xs text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
