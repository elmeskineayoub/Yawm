"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteFocusSession } from "@/features/focus/actions";
import { formatDuration, PHASE_LABELS, type FocusPhase } from "@/features/focus/logic";
import type { RecentFocusSession } from "@/features/focus/queries";
import { formatDate } from "@/lib/dates";
import { formatTimeRange, instantToLocal } from "@/lib/dates/zoned";

export function FocusHistory({
  sessions,
  timezone,
}: {
  sessions: RecentFocusSession[];
  timezone: string;
}) {
  const [pending, startTransition] = useTransition();

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No focus sessions yet.</p>;
  }

  return (
    <ul aria-label="Recent focus sessions" className="divide-y divide-border">
      {sessions.map((s) => {
        const day = instantToLocal(s.started_at, timezone).date;
        return (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {PHASE_LABELS[s.session_type as FocusPhase]} · {formatDuration(s.duration_seconds)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(day, "short")} · {formatTimeRange(s.started_at, s.ended_at, timezone)}
                {s.task && (
                  <>
                    {" · "}
                    <Link href={`/tasks/${s.task.id}`} className="hover:underline">
                      {s.task.title}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              disabled={pending}
              aria-label="Delete session"
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteFocusSession(s.id);
                  if (!result.ok) toast.error(result.error);
                })
              }
            >
              Remove
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
