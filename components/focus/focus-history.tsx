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
import { safeAction } from "@/lib/safe-action";

export function FocusHistory({
  sessions,
  timezone,
  sessionProjects = {},
  projectNames = {},
}: {
  sessions: RecentFocusSession[];
  timezone: string;
  /** Session id -> project id, for sessions that counted toward a project. */
  sessionProjects?: Record<string, string>;
  projectNames?: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No focus sessions yet.</p>;
  }

  return (
    <ul aria-label="Recent focus sessions" className="divide-y divide-border">
      {sessions.map((s) => {
        const day = instantToLocal(s.started_at, timezone).date;
        const projectId = sessionProjects[s.id];
        const project = projectId ? projectNames[projectId] : undefined;
        return (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {PHASE_LABELS[s.session_type as FocusPhase]} · {formatDuration(s.duration_seconds)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(day, "short")} · {formatTimeRange(s.started_at, s.ended_at, timezone)}
                {project && projectId && (
                  <>
                    {" · "}
                    <Link href={`/projects/${projectId}`} className="hover:underline">
                      {project}
                    </Link>
                  </>
                )}
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
              size="xs"
              disabled={pending}
              aria-label={`Remove the ${formatDuration(s.duration_seconds)} session`}
              onClick={() =>
                startTransition(async () => {
                  const result = await safeAction(() => deleteFocusSession(s.id));
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
