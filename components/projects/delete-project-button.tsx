"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteProject } from "@/features/projects/actions";

export function DeleteProjectButton({
  projectId,
  name,
  taskCount,
}: {
  projectId: string;
  name: string;
  taskCount: number;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="secondary">Delete project</Button>}
      title="Delete this project?"
      description={
        <>
          <p>“{name}” will be permanently deleted.</p>
          {taskCount > 0 && (
            <p className="mt-2 font-medium text-foreground">
              Its {taskCount} task{taskCount === 1 ? " is" : "s are"} kept and will no longer belong
              to a project.
            </p>
          )}
          <p className="mt-2">To keep it for reference, set its status to Archived instead.</p>
        </>
      }
      confirmLabel="Delete"
      onConfirm={async () => {
        const result = await deleteProject(projectId);
        if (!result.ok) return result.error;
        router.push("/projects");
        return null;
      }}
    />
  );
}
