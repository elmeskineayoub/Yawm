"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTask } from "@/features/tasks/actions";

export function DeleteTaskButton({
  taskId,
  title,
  subtaskCount,
  redirectTo,
}: {
  taskId: string;
  title: string;
  subtaskCount: number;
  redirectTo: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="secondary">Delete task</Button>}
      title="Delete this task?"
      description={
        <>
          <p>“{title}” will be permanently deleted.</p>
          {subtaskCount > 0 && (
            <p className="mt-2 font-medium text-foreground">
              Its {subtaskCount} subtask{subtaskCount === 1 ? "" : "s"} will be deleted too.
            </p>
          )}
          <p className="mt-2">
            Links to plans and dependencies are removed. To keep a record, mark it cancelled
            instead.
          </p>
        </>
      }
      confirmLabel="Delete"
      onConfirm={async () => {
        const result = await deleteTask(taskId);
        if (!result.ok) return result.error;
        router.push(redirectTo);
        return null;
      }}
    />
  );
}
