"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { controlClass } from "@/components/ui/field";
import { convertIdea, deleteIdea, setIdeaStatus } from "@/features/inbox/actions";
import { IDEA_STATUS_LABELS, type IdeaStatus } from "@/features/inbox/schemas";
import { cn } from "@/lib/utils";

type IdeaActionsProps = {
  idea: {
    id: string;
    title: string;
    status: IdeaStatus;
    converted_task_id: string | null;
    converted_project_id: string | null;
    converted_goal_id: string | null;
  };
  afterDelete?: string;
};

export function IdeaActions({ idea, afterDelete }: IdeaActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const convert = (target: "task" | "project" | "goal") =>
    startTransition(async () => {
      const result = await convertIdea(idea.id, target);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Converted to a ${target}. The original idea is kept in Archived.`);
      router.push(result.data.href);
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor={`status-${idea.id}`}>
        Status of “{idea.title}”
      </label>
      <select
        id={`status-${idea.id}`}
        value={idea.status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            const result = await setIdeaStatus(idea.id, next);
            if (!result.ok) toast.error(result.error);
          });
        }}
        className={cn(controlClass, "w-auto py-1 text-xs")}
      >
        {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((s) => (
          <option key={s} value={s}>
            {IDEA_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {idea.converted_task_id ? (
        <Link
          href={`/tasks/${idea.converted_task_id}`}
          className="px-2 text-xs text-accent hover:underline"
        >
          Open task
        </Link>
      ) : (
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          disabled={pending}
          onClick={() => convert("task")}
          aria-label={`Convert “${idea.title}” to a task`}
        >
          → Task
        </Button>
      )}
      {idea.converted_project_id ? (
        <Link
          href={`/projects/${idea.converted_project_id}`}
          className="px-2 text-xs text-accent hover:underline"
        >
          Open project
        </Link>
      ) : (
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          disabled={pending}
          onClick={() => convert("project")}
          aria-label={`Convert “${idea.title}” to a project`}
        >
          → Project
        </Button>
      )}
      {idea.converted_goal_id ? (
        <Link
          href={`/goals/${idea.converted_goal_id}`}
          className="px-2 text-xs text-accent hover:underline"
        >
          Open goal
        </Link>
      ) : (
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          disabled={pending}
          onClick={() => convert("goal")}
          aria-label={`Convert “${idea.title}” to a goal`}
        >
          → Goal
        </Button>
      )}
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            aria-label={`Delete “${idea.title}”`}
          >
            Delete
          </Button>
        }
        title="Delete this idea?"
        description={
          <p>
            “{idea.title}” will be permanently deleted. Tasks, projects, or goals made from it are
            kept. To keep it out of the way instead, set its status to Archived.
          </p>
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          const result = await deleteIdea(idea.id);
          if (!result.ok) return result.error;
          if (afterDelete) router.push(afterDelete);
          return null;
        }}
      />
    </div>
  );
}
