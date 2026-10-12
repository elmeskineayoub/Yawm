"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { PlanPeriod } from "@/lib/dates";
import { cn } from "@/lib/utils";

const VIEWS: { value: PlanPeriod; label: string; key: string }[] = [
  { value: "day", label: "Day", key: "d" },
  { value: "week", label: "Week", key: "w" },
  { value: "month", label: "Month", key: "m" },
  { value: "year", label: "Year", key: "y" },
];

type PlannerHeaderProps = {
  view: PlanPeriod;
  title: string;
  subtitle?: string;
  isCurrent: boolean;
  viewHrefs: Record<PlanPeriod, string>;
  prevHref: string;
  nextHref: string;
  todayHref: string;
};

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Period switcher and navigation. Shortcuts outside text fields: d / w / m / y switch views,
 * t jumps to today, and ← / → move to the previous or next period.
 */
export function PlannerHeader({
  view,
  title,
  subtitle,
  isCurrent,
  viewHrefs,
  prevHref,
  nextHref,
  todayHref,
}: PlannerHeaderProps) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      const match = VIEWS.find((v) => v.key === event.key);
      if (match) router.push(viewHrefs[match.value]);
      else if (event.key === "t") router.push(todayHref);
      else if (event.key === "ArrowLeft") router.push(prevHref);
      else if (event.key === "ArrowRight") router.push(nextHref);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, viewHrefs, todayHref, prevHref, nextHref]);

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <nav
          aria-label="Planner view"
          className="flex rounded-md border border-border p-0.5 text-sm"
        >
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={viewHrefs[v.value]}
              aria-current={v.value === view ? "page" : undefined}
              aria-keyshortcuts={v.key}
              title={`${v.label} (${v.key})`}
              className={cn(
                "rounded px-3 py-1",
                v.value === view
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link
            href={prevHref}
            aria-label={`Previous ${view}`}
            aria-keyshortcuts="ArrowLeft"
            className="rounded-md border border-border p-1.5 hover:bg-surface-muted"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <Link
            href={todayHref}
            aria-keyshortcuts="t"
            aria-current={isCurrent ? "date" : undefined}
            className={cn(
              "rounded-md border border-border px-3 py-1 text-sm hover:bg-surface-muted",
              isCurrent && "text-muted-foreground",
            )}
          >
            Today
          </Link>
          <Link
            href={nextHref}
            aria-label={`Next ${view}`}
            aria-keyshortcuts="ArrowRight"
            className="rounded-md border border-border p-1.5 hover:bg-surface-muted"
          >
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
