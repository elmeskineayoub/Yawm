"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { syncGoogleCalendar } from "@/features/google-calendar/actions";
import type { GoogleConnectionState } from "@/features/google-calendar/types";
import { cn } from "@/lib/utils";

type Phase = "idle" | "syncing" | "synced" | "waiting" | "failed";

/**
 * Pushes block changes to Google after each edit and when the Planner opens with work pending.
 * Honest states only: "Synced with Google" appears after Google and the database confirmed.
 */
export function useGoogleSync(state: GoogleConnectionState) {
  const router = useRouter();
  const active = state.available && state.connected && state.status !== "reconnect_required";
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const running = useRef(false);
  const again = useRef(false);

  const run = useCallback(
    async (manual = false) => {
      if (!active) return;
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      setPhase("syncing");
      try {
        do {
          again.current = false;
          const result = await syncGoogleCalendar(manual);
          if (!result.ok) {
            setPhase("failed");
            setMessage(result.error);
            break;
          }
          const s = result.data;
          if (s.stopped === "not_connected") {
            setPhase("idle");
          } else if (s.stopped || s.failed) {
            setPhase(s.stopped === "rate_limited" ? "waiting" : "failed");
            setMessage(s.message);
          } else {
            setPhase(s.remaining > 0 ? "waiting" : "synced");
            setMessage(s.remaining > 0 ? `${s.remaining} more waiting` : null);
            if (s.remaining > 0) again.current = true;
          }
        } while (again.current);
      } finally {
        running.current = false;
        router.refresh();
      }
    },
    [active, router],
  );

  // Catch up once when the Planner opens with unsynced work, unless Google asked us to wait.
  const pending = state.available && state.connected ? state.pending + state.failed : 0;
  const backoff =
    state.available && state.connected && state.retryAfter ? Date.parse(state.retryAfter) : 0;
  const started = useRef(false);
  useEffect(() => {
    // Decided once per visit: later failures wait for Retry or the next edit, never a loop.
    if (started.current) return;
    started.current = true;
    if (!active || pending === 0 || backoff > Date.now()) return;
    void run();
  }, [active, pending, backoff, run]);

  return { phase, message, run };
}

export function GoogleSyncStatus({
  state,
  phase,
  message,
  onRetry,
}: {
  state: GoogleConnectionState;
  phase: Phase;
  message: string | null;
  onRetry: () => void;
}) {
  if (!state.available || !state.connected) return null;
  if (state.status === "reconnect_required") {
    return (
      <Link
        href="/settings#google"
        className="text-red-700 underline-offset-2 hover:underline dark:text-red-400"
      >
        Reconnect Google Calendar
      </Link>
    );
  }
  const waiting = state.pending + state.failed;
  const label =
    phase === "syncing"
      ? "Syncing to Google…"
      : phase === "synced"
        ? "Synced with Google"
        : phase === "failed"
          ? "Google sync failed"
          : phase === "waiting"
            ? "Waiting to sync to Google"
            : waiting > 0
              ? `${waiting} waiting for Google`
              : "Synced with Google";
  const problem = phase === "failed" || phase === "waiting" || (phase === "idle" && waiting > 0);
  return (
    <span className="flex items-center gap-1.5" title={message ?? undefined}>
      <span
        role="status"
        aria-live="polite"
        className={cn(phase === "failed" && "text-amber-800 dark:text-amber-300")}
      >
        {label}
        {message && <span className="sr-only">: {message}</span>}
      </span>
      {problem && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded px-1 underline underline-offset-2 hover:text-foreground"
        >
          Retry
        </button>
      )}
    </span>
  );
}
