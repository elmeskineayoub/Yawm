"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { QuickCaptureButton, QuickCaptureProvider } from "@/components/shared/quick-capture";
import { Sheet, SheetTitle } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import type { Reminder } from "@/features/reminders/logic";
import type { IsoDate } from "@/lib/dates";
import { contentWidthFor, type ContentWidth } from "@/lib/navigation";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-cookie";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { BrandLogo } from "./brand-logo";
import { FocusChip } from "./focus-chip";
import { GlobalSearchProvider, SearchButton } from "./global-search";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { MobileTabBar } from "./mobile-tab-bar";
import { NavigationProgress } from "./navigation-progress";
import { OfflineBanner } from "./offline-banner";
import { ReminderCenter } from "./reminder-center";
import { layoutOf, SidebarNav } from "./sidebar-nav";

const WIDTH: Record<ContentWidth, string> = {
  wide: "max-w-[96rem]",
  standard: "max-w-6xl",
  reading: "max-w-3xl",
};

/** Remember the choice on this device. A cookie (not localStorage) so the server renders it. */
function rememberCollapsed(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
}

export function AppShell({
  children,
  account,
  reminders = [],
  inboxCount = 0,
  initialCollapsed = false,
  today = null,
}: {
  children: ReactNode;
  account?: { email: string | null };
  reminders?: Reminder[];
  inboxCount?: number;
  initialCollapsed?: boolean;
  /** The user's date in their timezone (for capture shortcuts); null if unavailable. */
  today?: IsoDate | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const layout = layoutOf("sidebar", collapsed);

  // Close the mobile menu after navigation.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    rememberCollapsed(next);
  };
  // Collapsing only applies where there is room for the labelled sidebar (lg and up); below that
  // the sidebar is always an icon rail, so the toggle is hidden.
  const toggleButton = (
    <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="hidden rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground lg:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpen aria-hidden className="size-4" />
        ) : (
          <PanelLeftClose aria-hidden className="size-4" />
        )}
      </button>
    </Tooltip>
  );

  const railHeader = (
    <div className="flex flex-col items-center gap-1 px-2 pt-3">
      <BrandLogo showText={false} heightRem={1.3} className="mb-1" />
      {toggleButton}
      {account && <ReminderCenter reminders={reminders} align="left" />}
    </div>
  );
  const fullHeader = (
    <div className="flex h-14 items-center justify-between px-3">
      <BrandLogo className="px-1" />
      <div className="flex items-center gap-1">
        {account && <ReminderCenter reminders={reminders} align="left" />}
        {toggleButton}
      </div>
    </div>
  );

  const content = (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop and tablet sidebar: stays in view while the page scrolls. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex",
          collapsed ? "w-16" : "w-16 lg:w-60",
        )}
      >
        {collapsed ? (
          railHeader
        ) : (
          <>
            <div className="lg:hidden">{railHeader}</div>
            <div className="hidden lg:block">{fullHeader}</div>
          </>
        )}
        {account && (
          <div className="space-y-1 px-2 pt-2 pb-3">
            <QuickCaptureButton layout={layout} />
            <SearchButton layout={layout} />
            {collapsed ? (
              <FocusChip collapsed />
            ) : (
              <>
                <div className="lg:hidden">
                  <FocusChip collapsed />
                </div>
                <div className="hidden lg:block">
                  <FocusChip />
                </div>
              </>
            )}
          </div>
        )}
        <SidebarNav collapsed={collapsed} inboxCount={inboxCount} />
        {account && <AccountMenu email={account.email} layout={layout} />}
      </aside>

      {/* Phone menu ("More" in the tab bar). */}
      <Sheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        side="left"
        size="nav"
        id="mobile-navigation"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-14 items-center px-4">
          <BrandLogo className="px-1" />
        </div>
        {account && (
          <div className="px-2 pb-2">
            <FocusChip />
          </div>
        )}
        <SidebarNav collapsed={false} variant="drawer" inboxCount={inboxCount} />
        {account && <AccountMenu email={account.email} layout="full" />}
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:hidden">
          <BrandLogo />
          {account && (
            <div className="ml-auto flex items-center gap-1">
              <SearchButton variant="icon" />
              <ReminderCenter reminders={reminders} />
            </div>
          )}
        </header>
        <OfflineBanner />
        <main
          id="main-content"
          className={cn(
            "mx-auto w-full flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12",
            WIDTH[contentWidthFor(pathname)],
          )}
        >
          {children}
        </main>
      </div>

      {account && (
        <MobileTabBar
          inboxCount={inboxCount}
          moreOpen={mobileOpen}
          onOpenMore={() => setMobileOpen(true)}
        />
      )}
    </div>
  );

  return (
    <>
      {/* useSearchParams needs a Suspense boundary; the bar is decorative, so no fallback. */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      {account ? (
        <QuickCaptureProvider today={today}>
          <GlobalSearchProvider>{content}</GlobalSearchProvider>
          <KeyboardShortcuts />
        </QuickCaptureProvider>
      ) : (
        content
      )}
    </>
  );
}
