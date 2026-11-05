import { notFound } from "next/navigation";
import { z } from "zod";
import { TaskDetailView } from "@/components/tasks/task-detail";
import { TaskPanel } from "@/components/tasks/task-panel";
import { loadTaskDetail } from "@/features/tasks/detail";
import { getWorkspaceContext } from "@/lib/workspace-context";

/**
 * A task opened from anywhere in the app shows in a side panel over the current page (intercepted
 * route). Refreshing or visiting the URL directly renders app/(app)/tasks/[id] instead.
 */
export default async function TaskPanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await getWorkspaceContext();
  const detail = await loadTaskDetail(ctx, id);
  if (!detail) notFound();
  return (
    <TaskPanel taskId={detail.task.id} title={detail.task.title}>
      <TaskDetailView detail={detail} today={ctx.today} timezone={ctx.timezone} variant="panel" />
    </TaskPanel>
  );
}
