"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-4">
      <ul className="space-y-0.5">
        {primaryNavigation.map(({ label, href, icon: Icon, available }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const content = (
            <>
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
              {!available && !collapsed && (
                <span className="ml-auto text-xs text-muted-foreground">Soon</span>
              )}
            </>
          );
          const itemClass = cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
            collapsed && "justify-center px-0",
          );

          return (
            <li key={href}>
              {available ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    itemClass,
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title={`${label} is not available yet`}
                  className={cn(itemClass, "cursor-not-allowed text-muted-foreground opacity-60")}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
