import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Item<T extends string> = {
  value: T;
  label: ReactNode;
  /** Render as a link (URL-driven views). Omit for in-page toggles. */
  href?: string;
  title?: string;
  keyShortcut?: string;
};

type SegmentedControlProps<T extends string> = {
  items: readonly Item<T>[];
  value: T;
  /** Accessible name for the group, e.g. "Planner view". */
  label: string;
  /** Required for button items. */
  onChange?: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
};

/**
 * One choice out of a few, shown side by side. Link items use `aria-current` inside a <nav>;
 * button items use `aria-pressed` inside a role="group".
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  label,
  onChange,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const isNav = items.every((item) => item.href);
  const itemClass = (active: boolean) =>
    cn(
      "rounded-[5px] font-medium transition-colors duration-150",
      size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1 text-sm",
      active
        ? "bg-surface text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-border"
        : "text-muted-foreground hover:text-foreground",
    );
  const wrapperClass = cn(
    "inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-muted p-0.5",
    className,
  );

  if (isNav) {
    return (
      <nav aria-label={label} className={wrapperClass}>
        {items.map((item) => (
          <Link
            key={item.value}
            href={item.href!}
            aria-current={item.value === value ? "page" : undefined}
            aria-keyshortcuts={item.keyShortcut}
            title={item.title}
            className={itemClass(item.value === value)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <div role="group" aria-label={label} className={wrapperClass}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={item.value === value}
          aria-keyshortcuts={item.keyShortcut}
          title={item.title}
          onClick={() => onChange?.(item.value)}
          className={itemClass(item.value === value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
