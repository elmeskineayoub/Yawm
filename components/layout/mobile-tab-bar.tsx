"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QuickCaptureButton } from "@/components/shared/quick-capture";
import { isActivePath, mobileTabs, primaryNavigation, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const byHref = (href: string): NavItem => {
  const item = primaryNavigation.find((i) => i.href === href);
  if (!item) throw new Error(`Unknown navigation item ${href}`);
  return item;
};

const tabClass =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.6875rem] leading-none font-medium transition-colors duration-150";

function Tab({ item, pathname, badge }: { item: NavItem; pathname: string; badge?: number }) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(tabClass, active ? "text-accent" : "text-muted-foreground")}
    >
      <span className="relative">
        <Icon aria-hidden className="size-5" />
        {badge !== undefined && badge > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-2 min-w-4 rounded-full bg-accent px-1 text-center text-[0.625rem] leading-4 text-accent-foreground tabular-nums"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span>
        {item.label}
        {badge !== undefined && badge > 0 && <span className="sr-only">, {badge} to triage</span>}
      </span>
    </Link>
  );
}

/**
 * Phone navigation: the daily destinations within thumb reach, capture in the middle, and "More"
 * for everything else (opens the full menu). Hidden from the md breakpoint, where the sidebar takes
 * over.
 */
export function MobileTabBar({
  inboxCount,
  onOpenMore,
  moreOpen,
}: {
  inboxCount: number;
  onOpenMore: () => void;
  moreOpen: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-center px-2">
        {mobileTabs.before.map((href) => (
          <Tab key={href} item={byHref(href)} pathname={pathname} />
        ))}
        <div className="flex flex-1 justify-center">
          <QuickCaptureButton variant="tab" />
        </div>
        {mobileTabs.after.map((href) => (
          <Tab
            key={href}
            item={byHref(href)}
            pathname={pathname}
            badge={href === "/inbox" ? inboxCount : undefined}
          />
        ))}
        <button
          type="button"
          onClick={onOpenMore}
          aria-expanded={moreOpen}
          aria-controls="mobile-navigation"
          className={cn(tabClass, "text-muted-foreground")}
        >
          <Menu aria-hidden className="size-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
