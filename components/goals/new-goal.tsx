"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { Sheet, SheetHeader } from "@/components/ui/sheet";
import { createGoal } from "@/features/goals/actions";
import type { FieldErrors } from "@/lib/action-result";
import { safeAction } from "@/lib/safe-action";

type Area = { id: string; name: string; archived_at: string | null };

/**
 * "New goal" opens a side sheet: a name, and optionally why it matters, a life area, and a target
 * date. Milestones, linked work, and a measurable target are added on the goal itself.
 */
export function NewGoal({
  areas,
  variant = "primary",
}: {
  areas: Area[];
  variant?: "primary" | "outline";
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const err = (field: string) =>
    errors[field]?.length ? (
      <p className="text-xs text-danger">{errors[field]!.join(" ")}</p>
    ) : null;

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => {
          setFormKey((k) => k + 1);
          setErrors({});
          setStatus(null);
          setOpen(true);
        }}
      >
        <Plus aria-hidden className="size-4" />
        New goal
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetHeader
          title="New goal"
          description="An outcome you're working towards. Break it into milestones once it exists."
        />
        <form
          key={formKey}
          aria-label="New goal"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const input = Object.fromEntries(new FormData(e.currentTarget));
            startTransition(async () => {
              setStatus(null);
              const result = await safeAction(() => createGoal(input));
              if (!result.ok) {
                setErrors(result.fieldErrors ?? {});
                setStatus(result.error);
                return;
              }
              setOpen(false);
              toast.success(`“${String(input.title).trim()}” added`, {
                action: { label: "Open", onClick: () => router.push(`/goals/${result.data.id}`) },
              });
              router.refresh();
            });
          }}
        >
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
              placeholder="e.g. Run a half marathon"
              aria-invalid={errors.title?.length ? true : undefined}
              className={controlClass}
            />
            {err("title")}
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-why`} className="block text-sm font-medium">
              Why it matters (optional)
            </label>
            <textarea
              id={`${id}-why`}
              name="why"
              rows={3}
              maxLength={2000}
              placeholder="The reason you'll come back to when it gets hard…"
              className={controlClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor={`${id}-area`} className="block text-sm font-medium">
                Life area
              </label>
              <select id={`${id}-area`} name="area_id" defaultValue="" className={controlClass}>
                <option value="">None</option>
                {areas
                  .filter((a) => !a.archived_at)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-target`} className="block text-sm font-medium">
                Target date (optional)
              </label>
              <input id={`${id}-target`} name="target_date" type="date" className={controlClass} />
              {err("target_date")}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Create goal"}
            </Button>
            <span role="status" aria-live="polite" className="text-sm text-danger">
              {status}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
