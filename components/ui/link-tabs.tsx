import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LinkTab = { key: string; href: string; label: ReactNode; count?: number };

/** Underlined tabs for URL-driven sub-views (statuses, sub-pages). Scrolls sideways on phones. */
export function LinkTabs({
  tabs,
  current,
  label,
  className,
}: {
  tabs: readonly LinkTab[];
  current: string;
  /** Accessible name for the navigation, e.g. "Idea status". */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("overflow-x-auto border-b border-border", className)}>
      <ul className="flex gap-2">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Inset focus ring: the scroll container would clip an outset one.
                  "-mb-px flex items-center gap-1.5 rounded-t-sm border-b-2 px-1.5 py-2 text-sm transition-colors duration-150 focus-visible:-outline-offset-2",
                  active
                    ? "border-accent font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="text-xs text-muted-foreground tabular-nums">{tab.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
