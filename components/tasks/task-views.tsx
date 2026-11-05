import { LinkTabs } from "@/components/ui/link-tabs";
import { taskFiltersToSearch, type TaskFilters } from "@/features/tasks/filters";

/**
 * The everyday slices of the task list, as tabs. Each is a combination of the existing status and
 * due filters (so it is a plain, shareable URL) and keeps every other filter as it is.
 */
export const TASK_VIEWS = [
  { key: "open", label: "Open", status: "open", due: "any" },
  { key: "today", label: "Today", status: "open", due: "today" },
  { key: "week", label: "Next 7 days", status: "open", due: "week" },
  { key: "overdue", label: "Overdue", status: "open", due: "overdue" },
  { key: "nodate", label: "No date", status: "open", due: "none" },
  { key: "done", label: "Completed", status: "done", due: "any" },
] as const satisfies readonly {
  key: string;
  label: string;
  status: TaskFilters["status"];
  due: TaskFilters["due"];
}[];

/** The quick view these filters correspond to, if any. */
export function currentTaskView(filters: TaskFilters): string {
  return TASK_VIEWS.find((v) => v.status === filters.status && v.due === filters.due)?.key ?? "";
}

export function TaskViews({ filters }: { filters: TaskFilters }) {
  return (
    <LinkTabs
      label="Task views"
      current={currentTaskView(filters)}
      tabs={TASK_VIEWS.map((v) => ({
        key: v.key,
        label: v.label,
        href: `/tasks${taskFiltersToSearch(filters, { status: v.status, due: v.due })}`,
      }))}
    />
  );
}
