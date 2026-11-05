"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Show only for navigations slow enough to notice, and never get stuck. */
const SHOW_AFTER_MS = 150;
const GIVE_UP_AFTER_MS = 15_000;

/** True for a plain left click on an in-app link that leads somewhere else. */
function isInternalNavigation(event: MouseEvent): boolean {
  // Runs in the capture phase, before next/link's own handler calls preventDefault() to take over
  // the navigation, so defaultPrevented is not a usable signal here.
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page and query (an anchor jump or the current page) does not navigate.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * A thin bar at the top of the page while an in-app navigation is loading. Route changes already
 * get `loading.tsx`; this covers navigations within a page, such as Planner periods and filters,
 * where the old content would otherwise sit unchanged with no sign that anything is happening.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [settledKey, setSettledKey] = useState(`${pathname}?${search}`);

  // A new URL means the navigation finished: hide the bar (render-time reset, no effect needed).
  const key = `${pathname}?${search}`;
  if (key !== settledKey) {
    setSettledKey(key);
    setStartedAt(null);
    setVisible(false);
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) setStartedAt(Date.now());
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const show = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const giveUp = window.setTimeout(() => {
      setStartedAt(null);
      setVisible(false);
    }, GIVE_UP_AFTER_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(giveUp);
    };
  }, [startedAt]);

  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-accent/15"
    >
      <div className="h-full w-1/3 animate-[progress-slide_1.1s_ease-in-out_infinite] bg-accent motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}
