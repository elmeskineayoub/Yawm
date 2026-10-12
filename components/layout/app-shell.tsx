"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { QuickCapture } from "@/components/shared/quick-capture";
import { AccountMenu } from "./account-menu";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({
  children,
  account,
}: {
  children: ReactNode;
  account?: { email: string | null };
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the mobile drawer after navigation.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-surface md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-14 items-center justify-between px-3">
          {!collapsed && <span className="px-2 text-base font-semibold">Yawm</span>}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="rounded p-2 text-muted-foreground hover:bg-surface-muted"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden className="size-4" />
            )}
          </button>
        </div>
        {account && (
          <div className="px-2 pb-3">
            <QuickCapture collapsed={collapsed} />
          </div>
        )}
        <SidebarNav collapsed={collapsed} />
        {account && <AccountMenu email={account.email} collapsed={collapsed} />}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-navigation"
            aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-lg"
          >
            <div className="flex h-14 items-center justify-between px-3">
              <span className="px-2 text-base font-semibold">Yawm</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded p-2 text-muted-foreground hover:bg-surface-muted"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            {account && (
              <div className="px-2 pb-3">
                <QuickCapture />
              </div>
            )}
            <SidebarNav collapsed={false} />
            {account && <AccountMenu email={account.email} collapsed={false} />}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            className="rounded p-2 text-muted-foreground hover:bg-surface-muted"
          >
            <Menu aria-hidden className="size-5" />
          </button>
          <span className="text-base font-semibold">Yawm</span>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
