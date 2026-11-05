"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetHeader } from "@/components/ui/sheet";
import { createHabit } from "@/features/habits/actions";
import { safeAction } from "@/lib/safe-action";
import { HabitForm, newHabitDefaults } from "./habit-form";

type Area = { id: string; name: string; archived_at: string | null };

/**
 * "New habit" opens a side sheet with the whole form, so the schedule, target, and area are set
 * when the habit is created instead of on a second page. The list stays visible behind it.
 */
export function NewHabit({
  areas,
  today,
  variant = "primary",
}: {
  areas: Area[];
  today: string;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A fresh form each time the sheet opens.
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Plus aria-hidden className="size-4" />
        New habit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetHeader
          title="New habit"
          description="Anything you want to do regularly. Rest days never count against a streak."
        />
        <HabitForm
          key={formKey}
          habit={newHabitDefaults(today)}
          areas={areas}
          withTitle
          submitLabel="Create habit"
          onSubmit={async (input) => {
            const result = await safeAction(() => createHabit(input));
            if (result.ok) {
              setOpen(false);
              toast.success(`“${String(input.title).trim()}” added`);
              router.refresh();
            }
            return result;
          }}
          footer={
            <Button
              type="button"
              variant="ghost"
              className="ml-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          }
        />
      </Sheet>
    </>
  );
}
