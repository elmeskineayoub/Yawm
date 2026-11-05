"use client";

import { ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { controlClass } from "@/components/ui/field";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { hasActiveFilters, taskFiltersToSearch, type TaskFilters } from "@/features/tasks/filters";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/features/tasks/logic";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * One filter as a chip: shows its current value, opens a keyboard-accessible menu, and applies
 * the choice at once by navigating to the filtered URL (filters live in the URL, so every state
 * is shareable and the back button undoes a change).
 */
function Chip({
  label,
  value,
  defaultValue,
  options,
  onChange,
}: {
  label: string;
  value: string;
  defaultValue: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const active = value !== defaultValue;
  const current = options.find((o) => o.value === value)?.label;
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          // Explicit name: as a flex container, the visible parts would be read as "Priority : High".
          aria-label={active && current ? `${label}: ${current}` : label}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[0.8125rem] transition-colors duration-150",
            active
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-border text-muted-foreground hover:border-input-border hover:text-foreground",
          )}
        >
          {/* One span, so the flex gap doesn't split "Priority" from its value. */}
          <span>
            {label}
            {active && current && <span className="font-medium">: {current}</span>}
          </span>
          <ChevronDown aria-hidden className="size-3.5" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="max-h-80 overflow-y-auto">
        <MenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <MenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

export function TaskFilterChips({
  filters,
  projects,
  areas,
  tags,
}: {
  filters: TaskFilters;
  projects: { id: string; name: string }[];
  areas: { id: string; name: string }[];
  tags: { id: string; name: string }[];
}) {
  const router = useRouter();
  const go = (overrides: Partial<TaskFilters>) =>
    router.push(`/tasks${taskFiltersToSearch(filters, overrides)}`);
  const any = { value: "", label: "Any" };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {/* A plain GET form, so search works even before JavaScript loads. */}
      <form
        method="get"
        role="search"
        aria-label="Search tasks"
        className="relative min-w-0 sm:w-64 sm:flex-none"
      >
        {Object.entries(
          Object.fromEntries(new URLSearchParams(taskFiltersToSearch(filters, { q: null }))),
        ).map(([key, val]) => (
          <input key={key} type="hidden" name={key} value={val} />
        ))}
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <label htmlFor="task-search" className="sr-only">
          Search tasks
        </label>
        <input
          id="task-search"
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search title or notes"
          className={cn(controlClass, "h-8 rounded-full py-1 pl-8 text-[0.8125rem]")}
        />
      </form>
      {/* Phones: one row that scrolls sideways (padding keeps focus rings visible). */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:p-0 [&>*]:shrink-0">
        <Chip
          label="Status"
          value={filters.status}
          defaultValue={filters.view === "board" ? "all" : "open"}
          options={[
            { value: "open", label: "Open" },
            { value: "all", label: "All" },
            ...TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          ]}
          onChange={(v) => go({ status: v as TaskFilters["status"] })}
        />
        <Chip
          label="Priority"
          value={filters.priority ?? ""}
          defaultValue=""
          options={[any, ...TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))]}
          onChange={(v) => go({ priority: (v || null) as TaskFilters["priority"] })}
        />
        {projects.length > 0 && (
          <Chip
            label="Project"
            value={filters.projectId ?? ""}
            defaultValue=""
            options={[any, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            onChange={(v) => go({ projectId: v || null })}
          />
        )}
        {areas.length > 0 && (
          <Chip
            label="Area"
            value={filters.areaId ?? ""}
            defaultValue=""
            options={[any, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
            onChange={(v) => go({ areaId: v || null })}
          />
        )}
        {tags.length > 0 && (
          <Chip
            label="Tag"
            value={filters.tagId ?? ""}
            defaultValue=""
            options={[any, ...tags.map((t) => ({ value: t.id, label: t.name }))]}
            onChange={(v) => go({ tagId: v || null })}
          />
        )}
        <Chip
          label="Sort"
          value={filters.sort}
          defaultValue="due"
          options={[
            { value: "due", label: "Due date" },
            { value: "priority", label: "Priority" },
            { value: "created", label: "Newest" },
            { value: "title", label: "Title" },
          ]}
          onChange={(v) => go({ sort: v as TaskFilters["sort"] })}
        />
        {filters.view === "list" && (
          <Chip
            label="Group"
            value={filters.group}
            defaultValue="none"
            options={[
              { value: "none", label: "None" },
              { value: "status", label: "Status" },
              { value: "priority", label: "Priority" },
              { value: "project", label: "Project" },
            ]}
            onChange={(v) => go({ group: v as TaskFilters["group"] })}
          />
        )}
        {(hasActiveFilters(filters) || filters.sort !== "due" || filters.group !== "none") && (
          <Link
            href={filters.view === "board" ? "/tasks?view=board" : "/tasks"}
            className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-[0.8125rem] text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="size-3.5" />
            Clear
          </Link>
        )}
      </div>
    </div>
  );
}
