"use client";

import { Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  FOCUS_TIMER_STORAGE_KEY,
  formatClock,
  isTimerActive,
  parseStoredTimer,
  remainingSeconds,
} from "@/features/focus/logic";
import { cn } from "@/lib/utils";

// Re-read once a second (the countdown) and whenever another tab changes the timer.
function subscribe(onChange: () => void) {
  const interval = window.setInterval(onChange, 1000);
  window.addEventListener("storage", onChange);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener("storage", onChange);
  };
}
// The snapshot is a string so React can compare it cheaply: the stored timer plus the current second.
function getSnapshot(): string {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(FOCUS_TIMER_STORAGE_KEY);
  } catch {
    raw = null;
  }
  return `${Math.floor(Date.now() / 1000)}|${raw ?? ""}`;
}
const getServerSnapshot = () => "";

/**
 * Shows a running (or paused) focus timer from any page, linking back to it. The timer itself
 * lives in this browser only (see the focus timer); nothing here touches the server.
 */
export function FocusChip({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // The timer itself is on screen on these pages.
  if (!snapshot || pathname === "/focus" || pathname === "/today") return null;

  const separator = snapshot.indexOf("|");
  const now = Number(snapshot.slice(0, separator)) * 1000;
  const timer = parseStoredTimer(snapshot.slice(separator + 1) || null);
  if (!isTimerActive(timer, now)) return null;

  const clock = formatClock(remainingSeconds(timer, now));
  const what = timer.phase === "focus" ? "Focus" : "Break";
  const state = timer.running ? what : `${what} paused`;
  const label = `${state}, ${clock} left. Open the focus timer.`;

  const link = (
    <Link
      href="/focus"
      aria-label={label}
      className={cn(
        "flex h-9 items-center rounded-md text-sm text-accent hover:bg-accent-soft",
        collapsed ? "justify-center" : "gap-2 px-3",
      )}
    >
      <span className="relative inline-flex">
        <Timer aria-hidden className="size-4" />
        {timer.running && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-1.5 animate-pulse rounded-full bg-accent"
          />
        )}
      </span>
      {!collapsed && (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{state}</span>
          <span className="font-medium tabular-nums">{clock}</span>
        </span>
      )}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={`${state} · ${clock}`} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
