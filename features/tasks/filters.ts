import { z } from "zod";
import { normalizeQuery } from "@/lib/search";
import type { SortKey, TaskPriority, TaskStatus } from "./logic";

export type StatusFilter = "open" | "all" | TaskStatus;
export type DueFilter = "any" | "overdue" | "today" | "week" | "none";
export type GroupKey = "none" | "status" | "priority" | "project";
export type ViewKey = "list" | "board";

export type TaskFilters = {
  q: string | null;
  status: StatusFilter;
  priority: TaskPriority | null;
  projectId: string | null;
  areaId: string | null;
  tagId: string | null;
  due: DueFilter;
  sort: SortKey;
  group: GroupKey;
  view: ViewKey;
};

type Params = Record<string, string | string[] | undefined>;

function pick<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = Array.isArray(value) ? value[0] : value;
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function id(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return z.uuid().safeParse(raw).success ? (raw as string) : null;
}

function defaultStatus(view: ViewKey): StatusFilter {
  return view === "board" ? "all" : "open";
}

/** Parses `/tasks` search params; anything unknown falls back to a safe default. */
export function parseTaskFilters(params: Params): TaskFilters {
  const priority = pick(params.priority, ["low", "medium", "high", "urgent", ""] as const, "");
  const view = pick(params.view, ["list", "board"] as const, "list");
  return {
    q: normalizeQuery(params.q),
    status: pick(
      params.status,
      ["open", "all", "todo", "in_progress", "done", "cancelled"] as const,
      // The board has a column per status, so it shows everything by default.
      defaultStatus(view),
    ),
    priority: priority === "" ? null : priority,
    projectId: id(params.project),
    areaId: id(params.area),
    tagId: id(params.tag),
    due: pick(params.due, ["any", "overdue", "today", "week", "none"] as const, "any"),
    sort: pick(params.sort, ["due", "priority", "created", "title"] as const, "due"),
    group: pick(params.group, ["none", "status", "priority", "project"] as const, "none"),
    view,
  };
}

/** Serialises filters back to a query string, omitting defaults. */
export function taskFiltersToSearch(filters: TaskFilters, overrides: Partial<TaskFilters> = {}) {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.status !== defaultStatus(merged.view)) params.set("status", merged.status);
  if (merged.priority) params.set("priority", merged.priority);
  if (merged.projectId) params.set("project", merged.projectId);
  if (merged.areaId) params.set("area", merged.areaId);
  if (merged.tagId) params.set("tag", merged.tagId);
  if (merged.due !== "any") params.set("due", merged.due);
  if (merged.sort !== "due") params.set("sort", merged.sort);
  if (merged.group !== "none") params.set("group", merged.group);
  if (merged.view !== "list") params.set("view", merged.view);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return Boolean(
    filters.q ||
    filters.status !== defaultStatus(filters.view) ||
    filters.priority ||
    filters.projectId ||
    filters.areaId ||
    filters.tagId ||
    filters.due !== "any",
  );
}
