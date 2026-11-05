"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { useId, useState } from "react";
import { popoverClass } from "@/components/ui/surfaces";
import { cn } from "@/lib/utils";

export type PickerProject = { id: string; name: string; color: string | null };

/**
 * Searchable project picker for a focus session. "No project" is a real choice (general focus,
 * not counted toward any project). Disabled while a session is under way: the project cannot
 * change silently mid-session.
 */
export function ProjectPicker({
  projects,
  value,
  onChange,
  disabled,
}: {
  projects: PickerProject[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = projects.find((p) => p.id === value) ?? null;

  const options: { id: string | null; name: string; color: string | null }[] = [
    { id: null, name: "No project (general focus)", color: null },
    ...projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
  ];
  const activeIndex = Math.min(active, options.length - 1);
  const choose = (projectId: string | null) => {
    onChange(projectId);
    setOpen(false);
    setQuery("");
  };

  return (
    <div>
      <span id={`${id}-label`} className="block text-sm font-medium">
        Project
      </span>
      <Popover.Root open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-labelledby={`${id}-label ${id}-value`}
            className="mt-1 flex h-9 w-full items-center gap-2 rounded-md border border-input-border bg-surface px-3 text-left text-sm hover:border-muted-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-muted-foreground"
          >
            {selected?.color && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full ring-1 ring-foreground/20 ring-inset"
                style={{ backgroundColor: selected.color }}
              />
            )}
            <span id={`${id}-value`} className="min-w-0 flex-1 truncate">
              {selected ? selected.name : "No project (general focus)"}
            </span>
            <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className={cn(popoverClass, "w-[var(--radix-popover-trigger-width)] min-w-64 p-1")}
          >
            <div className="flex items-center gap-2 border-b border-border px-2 pb-1">
              <Search aria-hidden className="size-3.5 text-muted-foreground" />
              <input
                role="combobox"
                aria-label="Search projects"
                aria-expanded
                aria-controls={`${id}-list`}
                aria-activedescendant={`${id}-opt-${activeIndex}`}
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((activeIndex + 1) % options.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((activeIndex - 1 + options.length) % options.length);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const option = options[activeIndex];
                    if (option) choose(option.id);
                  }
                }}
                placeholder="Search projects"
                className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-label="Projects"
              className="max-h-64 overflow-y-auto py-1"
            >
              {options.map((o, i) => (
                <li
                  key={o.id ?? "none"}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={o.id === value}
                  onMouseMove={() => i !== activeIndex && setActive(i)}
                  onClick={() => choose(o.id)}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    i === activeIndex && "bg-surface-muted",
                    o.id === null && "text-muted-foreground",
                  )}
                >
                  {o.color ? (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full ring-1 ring-foreground/20 ring-inset"
                      style={{ backgroundColor: o.color }}
                    />
                  ) : (
                    <span aria-hidden className="size-2 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {o.id === value && <Check aria-hidden className="size-4 text-accent" />}
                </li>
              ))}
              {options.length === 1 && query && (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">No project matches.</li>
              )}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
