"use client";

import * as Popover from "@radix-ui/react-popover";
import { Link2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { linkToPlan, searchLinkable, type Linkable } from "@/features/planning/actions";
import { cn } from "@/lib/utils";

/** Search-as-you-type picker for linking an existing task or project to the period. */
export function LinkPopover({
  period,
  start,
  linkedIds,
}: {
  period: string;
  start: string;
  linkedIds: string[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Linkable[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const requestRef = useRef(0);
  const linkedKey = linkedIds.join(",");

  useEffect(() => {
    if (!open) return;
    const request = ++requestRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchLinkable(query);
      if (request !== requestRef.current) return;
      setLoading(false);
      const linked = new Set(linkedKey.split(","));
      setResults(result.ok ? result.data.filter((r) => !linked.has(r.id)) : []);
      setActive(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, linkedKey]);

  const choose = (item: Linkable) =>
    startTransition(async () => {
      const result = await linkToPlan(period, start, item.kind, item.id);
      if (result.ok) {
        toast.success(`Linked “${item.title}”`);
        setOpen(false);
        setQuery("");
      } else toast.error(result.error);
    });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" className="px-2 py-1 text-xs">
          <Link2 aria-hidden className="size-3.5" />
          Link existing
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background p-2 shadow-lg"
        >
          <label htmlFor={`${id}-q`} className="sr-only">
            Search tasks and projects
          </label>
          <input
            id={`${id}-q`}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={results[active] ? `${id}-opt-${active}` : undefined}
            autoFocus
            value={query}
            placeholder="Search tasks and projects…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                choose(results[active]);
              }
            }}
            className={controlClass}
          />
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Matches"
            className="mt-2 max-h-72 overflow-y-auto"
          >
            {results.map((item, index) => (
              <li
                key={`${item.kind}-${item.id}`}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1.5 text-sm",
                  index === active && "bg-surface-muted",
                  pending && "opacity-60",
                )}
              >
                <span className="block truncate">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
          {!loading && results.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {query ? "No matching open tasks or projects." : "No open tasks or projects to link."}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
