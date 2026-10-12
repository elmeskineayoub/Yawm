"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineEdit } from "@/components/ui/inline-edit";
import { deleteHabit, renameHabit, setHabitArchived } from "@/features/habits/actions";

export function HabitTitle({ habitId, title }: { habitId: string; title: string }) {
  return (
    <InlineEdit
      value={title}
      label="Habit"
      placeholder="Name the habit"
      maxLength={200}
      onSave={async (value) => {
        const result = await renameHabit(habitId, value);
        return result.ok ? null : result.error;
      }}
    />
  );
}

export function HabitArchiveDelete({
  habitId,
  title,
  archived,
}: {
  habitId: string;
  title: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setHabitArchived(habitId, !archived);
            if (!result.ok) toast.error(result.error);
            else toast.success(archived ? "Habit restored" : "Habit archived");
          })
        }
      >
        {archived ? "Restore" : "Archive"}
      </Button>
      <ConfirmDialog
        trigger={<Button variant="ghost">Delete</Button>}
        title={`Delete “${title}”?`}
        description={
          <p>
            Its whole history is deleted too. Archive it instead to stop tracking but keep the
            history.
          </p>
        }
        confirmLabel="Delete habit"
        onConfirm={async () => {
          const result = await deleteHabit(habitId);
          if (!result.ok) return result.error;
          toast.success("Habit deleted");
          router.push("/habits");
          return null;
        }}
      />
    </div>
  );
}
