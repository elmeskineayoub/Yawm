import Link from "next/link";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { hasActiveFilters, type TaskFilters } from "@/features/tasks/filters";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/features/tasks/logic";
import type { Lookups } from "@/features/tasks/queries";
import { cn } from "@/lib/utils";

/** A plain GET form: filters live in the URL, so they work without JavaScript and can be shared. */
export function TaskFiltersForm({ filters, lookups }: { filters: TaskFilters; lookups: Lookups }) {
  const select = cn(controlClass, "w-auto py-1.5");
  return (
    <form
      method="get"
      role="search"
      aria-label="Filter tasks"
      className="flex flex-wrap items-end gap-2"
    >
      {filters.view !== "list" && <input type="hidden" name="view" value={filters.view} />}
      <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1 text-xs text-muted-foreground">
        Search
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Title or notes"
          className={cn(controlClass, "py-1.5")}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Status
        <select name="status" defaultValue={filters.status} className={select}>
          <option value="open">Open</option>
          <option value="all">All</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Priority
        <select name="priority" defaultValue={filters.priority ?? ""} className={select}>
          <option value="">Any</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Due
        <select name="due" defaultValue={filters.due} className={select}>
          <option value="any">Any time</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="week">Next 7 days</option>
          <option value="none">No date</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Project
        <select name="project" defaultValue={filters.projectId ?? ""} className={select}>
          <option value="">Any</option>
          {lookups.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Area
        <select name="area" defaultValue={filters.areaId ?? ""} className={select}>
          <option value="">Any</option>
          {lookups.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {lookups.tags.length > 0 && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Tag
          <select name="tag" defaultValue={filters.tagId ?? ""} className={select}>
            <option value="">Any</option>
            {lookups.tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Sort
        <select name="sort" defaultValue={filters.sort} className={select}>
          <option value="due">Due date</option>
          <option value="priority">Priority</option>
          <option value="created">Newest</option>
          <option value="title">Title</option>
        </select>
      </label>
      {filters.view === "list" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Group
          <select name="group" defaultValue={filters.group} className={select}>
            <option value="none">None</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="project">Project</option>
          </select>
        </label>
      )}
      <Button type="submit" variant="secondary" className="py-1.5">
        Apply
      </Button>
      {hasActiveFilters(filters) && (
        <Link
          href={filters.view === "board" ? "/tasks?view=board" : "/tasks"}
          className="px-2 py-1.5 text-sm text-accent hover:underline"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
