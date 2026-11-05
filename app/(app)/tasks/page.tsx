import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFilterChips } from "@/components/tasks/filter-chips";
import { currentTaskView, TaskViews } from "@/components/tasks/task-views";
import { TaskList } from "@/components/tasks/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  hasActiveFilters,
  parseTaskFilters,
  taskFiltersToSearch,
  type TaskFilters,
} from "@/features/tasks/filters";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/features/tasks/logic";
import { loadFilteredTasks, loadLookups, type TaskView } from "@/features/tasks/queries";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Tasks" };

type Group = { key: string; label: string; tasks: TaskView[] };

function groupTasks(tasks: TaskView[], group: TaskFilters["group"]): Group[] {
  switch (group) {
    case "none":
      return [{ key: "all", label: "Tasks", tasks }];
    case "status":
      return TASK_STATUSES.map((s) => ({
        key: s,
        label: STATUS_LABELS[s],
        tasks: tasks.filter((t) => t.status === s),
      }));
    case "priority":
      return TASK_PRIORITIES.map((p) => ({
        key: p,
        label: PRIORITY_LABELS[p],
        tasks: tasks.filter((t) => t.priority === p),
      }));
    case "project": {
      const groups = new Map<string, Group>();
      for (const task of tasks) {
        const key = task.project?.id ?? "none";
        const entry = groups.get(key) ?? {
          key,
          label: task.project?.name ?? "No project",
          tasks: [],
        };
        entry.tasks.push(task);
        groups.set(key, entry);
      }
      return [...groups.values()].sort((a, b) =>
        a.key === "none" ? 1 : b.key === "none" ? -1 : a.label.localeCompare(b.label),
      );
    }
  }
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseTaskFilters(await searchParams);
  const ctx = await getWorkspaceContext();
  const lookups = await loadLookups(ctx);
  const { tasks, total, truncated } = await loadFilteredTasks(ctx, filters, lookups);
  const groups = groupTasks(tasks, filters.group).filter((g) => g.tasks.length > 0);

  // Empty states that match the view the user is looking at.
  const view = currentTaskView(filters);
  const narrowed = Boolean(
    filters.q || filters.priority || filters.projectId || filters.areaId || filters.tagId,
  );
  const [emptyTitle, emptyHint] = narrowed
    ? ["No tasks match these filters", "Try clearing a filter."]
    : view === "today"
      ? ["Nothing due today", "Pick something from Next 7 days, or enjoy the space."]
      : view === "week"
        ? ["Nothing due in the next 7 days", "Deadlines you add will show up here."]
        : view === "overdue"
          ? ["Nothing overdue", "You're caught up."]
          : view === "nodate"
            ? ["Every open task has a due date", ""]
            : view === "done"
              ? ["Nothing completed yet", "Finished tasks collect here."]
              : hasActiveFilters(filters)
                ? ["No tasks match these filters", "Try clearing a filter."]
                : ["No open tasks", "Add a task above, or capture an idea in the Inbox first."];

  return (
    <>
      <PageHeader
        title="Tasks"
        actions={
          <SegmentedControl
            label="View"
            value={filters.view}
            items={(["list", "board"] as const).map((view) => ({
              value: view,
              label: view === "list" ? "List" : "Board",
              href: `/tasks${taskFiltersToSearch(filters, { view, group: "none", status: view === "board" ? "all" : "open" })}`,
            }))}
          />
        }
      />

      <div className="space-y-4">
        <QuickAddTask />
        {filters.view === "list" && <TaskViews filters={filters} />}
        <TaskFilterChips
          filters={filters}
          projects={lookups.projects.filter((p) => p.status !== "archived")}
          areas={lookups.areas.filter((a) => !a.archived_at)}
          tags={lookups.tags}
        />

        {truncated && (
          <p role="status" className="text-sm text-muted-foreground">
            Showing the {tasks.length.toLocaleString("en-US")} most recently created of{" "}
            {total.toLocaleString("en-US")} matching tasks. Narrow the filters to see the rest.
          </p>
        )}

        {tasks.length === 0 ? (
          <EmptyState title={emptyTitle}>{emptyHint}</EmptyState>
        ) : filters.view === "board" ? (
          <TaskBoard tasks={tasks} today={ctx.today} />
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              {filters.group !== "none" && (
                <h2 id={`group-${group.key}`} className="mb-1 text-sm font-semibold">
                  {group.label}{" "}
                  <span className="font-normal text-muted-foreground">{group.tasks.length}</span>
                </h2>
              )}
              <TaskList
                tasks={group.tasks}
                today={ctx.today}
                label={group.label}
                showProject={filters.group !== "project"}
              />
            </section>
          ))
        )}
      </div>
    </>
  );
}
