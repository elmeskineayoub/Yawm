"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  isActivePath,
  navigationGroups,
  settingsNavigation,
  type NavItem,
  type ShellLayout,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * - "sidebar": desktop. Shows labels from the lg breakpoint unless the user collapsed it; between
 *   md and lg it is always an icon rail (tablets don't have room for both).
 * - "drawer": the mobile menu. Always shows labels.
 */
export type NavVariant = "sidebar" | "drawer";

type Layout = ShellLayout;

export function layoutOf(variant: NavVariant, collapsed: boolean): Layout {
  if (variant === "drawer") return "full";
  return collapsed ? "rail" : "responsive";
}

// Tailwind needs literal class names, so each layout spells out its own.
const LABEL: Record<Layout, string> = {
  full: "truncate",
  rail: "sr-only",
  responsive: "truncate max-lg:sr-only",
};
const ITEM: Record<Layout, string> = {
  full: "gap-3 px-3",
  rail: "justify-center px-0",
  responsive: "gap-3 px-3 max-lg:justify-center max-lg:px-0",
};
const GROUP_LABEL: Record<Layout, string> = {
  full: "label-caps px-3 pt-4 pb-1",
  rail: "sr-only",
  responsive: "label-caps px-3 pt-4 pb-1 max-lg:sr-only",
};
const GROUP_RULE: Record<Layout, string> = {
  full: "hidden",
  rail: "mx-3 my-2 block h-px bg-border",
  responsive: "mx-3 my-2 hidden h-px bg-border max-lg:block",
};
const BADGE: Record<Layout, string> = {
  full: "ml-auto",
  rail: "hidden",
  responsive: "ml-auto max-lg:hidden",
};
const DOT: Record<Layout, string> = {
  full: "hidden",
  rail: "absolute -top-0.5 -right-0.5",
  responsive: "absolute -top-0.5 -right-0.5 lg:hidden",
};
/** Tooltips only where the label is hidden. */
const TOOLTIP: Record<Layout, string> = {
  full: "hidden",
  rail: "",
  responsive: "lg:hidden",
};

/** Icon that pulses while its link's navigation is pending (must render inside the Link). */
function NavIcon({ icon: Icon, dot }: { icon: LucideIcon; dot?: string | undefined }) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative inline-flex shrink-0">
      <Icon aria-hidden className={cn("size-4", pending && "animate-pulse")} />
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full bg-accent", dot)} />}
    </span>
  );
}

function NavLink({
  item,
  layout,
  active,
  count,
}: {
  item: NavItem;
  layout: Layout;
  active: boolean;
  count?: number | undefined;
}) {
  const hasCount = count !== undefined && count > 0;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center rounded-md text-sm transition-colors duration-150",
        ITEM[layout],
        active
          ? "bg-accent-soft font-medium text-accent"
          : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      <NavIcon icon={item.icon} dot={hasCount ? DOT[layout] : undefined} />
      <span className={LABEL[layout]}>
        {item.label}
        {hasCount && <span className="sr-only">, {count} to triage</span>}
      </span>
      {hasCount && (
        <span
          aria-hidden
          className={cn("text-xs text-muted-foreground tabular-nums", BADGE[layout])}
        >
          {count}
        </span>
      )}
    </Link>
  );
  if (layout === "full") return link;
  return (
    <Tooltip content={item.label} side="right" contentClassName={TOOLTIP[layout]}>
      {link}
    </Tooltip>
  );
}

export function SidebarNav({
  collapsed,
  variant = "sidebar",
  inboxCount,
}: {
  collapsed: boolean;
  variant?: NavVariant;
  inboxCount?: number;
}) {
  const pathname = usePathname();
  const layout = layoutOf(variant, collapsed);

  return (
    <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col px-2 pb-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {navigationGroups.map((group, index) => (
          <div key={group.label ?? `group-${index}`}>
            {group.label && (
              <>
                <span aria-hidden className={GROUP_RULE[layout]} />
                <p className={GROUP_LABEL[layout]}>{group.label}</p>
              </>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    layout={layout}
                    active={isActivePath(pathname, item.href)}
                    count={item.href === "/inbox" ? inboxCount : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <ul className="mt-2 border-t border-border pt-2">
        <li>
          <NavLink
            item={settingsNavigation}
            layout={layout}
            active={isActivePath(pathname, settingsNavigation.href)}
          />
        </li>
      </ul>
    </nav>
  );
}
