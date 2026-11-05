import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import { TaskDetailView } from "@/components/tasks/task-detail";
import { loadTaskDetail } from "@/features/tasks/detail";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Task" };

/** The full task page: direct links and refreshes. In-app clicks open the side panel instead. */
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const ctx = await getWorkspaceContext();
  const detail = await loadTaskDetail(ctx, id);
  if (!detail) notFound();

  return (
    <article aria-label={detail.task.title}>
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link href="/tasks" className="hover:text-foreground hover:underline">
              Tasks
            </Link>
          </li>
          {detail.parent && (
            <li className="flex min-w-0 items-center gap-1">
              <ChevronRight aria-hidden className="size-3.5 shrink-0" />
              <Link
                href={`/tasks/${detail.parent.id}`}
                className="truncate hover:text-foreground hover:underline"
              >
                {detail.parent.title}
              </Link>
            </li>
          )}
        </ol>
      </nav>
      <h1 className="sr-only">{detail.task.title}</h1>
      <TaskDetailView detail={detail} today={ctx.today} timezone={ctx.timezone} variant="page" />
    </article>
  );
}
