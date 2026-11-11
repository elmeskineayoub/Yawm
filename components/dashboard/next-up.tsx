import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { formatMinutes } from "@/components/tasks/task-meta";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import type { DashboardModel, NextUpCandidate } from "@/features/dashboard/model";
import type { TaskView } from "@/features/tasks/queries";
import { cn } from "@/lib/utils";

/** The Focus page, preselecting this task (and its project, as a fallback). */
export function focusHref(task: Pick<TaskView, "id" | "project">): string {
  const params = new URLSearchParams({ task: task.id });
  if (task.project) params.set("project", task.project.id);
  return `/focus?${params.toString()}`;
}

function Reasons({
  reasons,
  className,
}: {
  reasons: NextUpCandidate["reasons"];
  className?: string;
}) {
  if (reasons.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Why this is next">
      {reasons.map((r) => (
        <li key={r.label}>
          <Badge tone={r.tone}>{r.label}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** Buttons are 36px with a mouse and a full 44px target on touch screens. */
const actionSize = "pointer-coarse:min-h-tap";

/**
 * The page's primary block: the one recommended next action, why it was picked, and the page's
 * only filled button (Start focus). It uses the same card surface as every other card; its weight
 * comes from the display-size title and the primary action, not from a different box. The order
 * behind the pick is fixed and explained (features/dashboard/model.ts, pickNextUp).
 */
export function NextUp({
  nextUp,
  className,
}: {
  nextUp: DashboardModel["nextUp"];
  className?: string;
}) {
  const { primary, then } = nextUp;
  return (
    <section aria-labelledby="next-up-heading" className={cn(cardClass, "min-w-0", className)}>
      <h3 id="next-up-heading" className="text-sm font-semibold text-muted-foreground">
        Next up
      </h3>
      {primary ? (
        <>
          <p className="mt-2 font-serif text-2xl leading-tight font-medium tracking-[-0.01em] break-words sm:text-display">
            <Link
              href={`/tasks/${primary.task.id}`}
              className="decoration-border underline-offset-4 hover:underline pointer-coarse:block pointer-coarse:py-2"
            >
              {primary.task.title}
            </Link>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
            {primary.task.project && (
              <Link
                href={`/projects/${primary.task.project.id}`}
                className="tap-target text-foreground hover:underline"
              >
                {primary.task.project.name}
              </Link>
            )}
            {primary.task.area && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full ring-1 ring-foreground/20 ring-inset"
                  style={{ backgroundColor: primary.task.area.color }}
                />
                {primary.task.area.name}
              </span>
            )}
            {primary.task.estimate_minutes ? (
              <span>{formatMinutes(primary.task.estimate_minutes)} estimated</span>
            ) : null}
          </div>
          <Reasons reasons={primary.reasons} className="mt-3" />
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link href={focusHref(primary.task)} className={buttonClass({ className: actionSize })}>
              <Play aria-hidden className="size-4" />
              Start focus
            </Link>
            <Link
              href={`/tasks/${primary.task.id}`}
              className={buttonClass({ variant: "secondary", className: actionSize })}
            >
              Open task
            </Link>
          </div>
          {then.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <h4 className="text-caption font-medium text-muted-foreground">After that</h4>
              <ul className="mt-1">
                {then.map((c) => (
                  <li
                    key={c.task.id}
                    className="flex items-center gap-2 border-b border-border py-2 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tasks/${c.task.id}`}
                        className="flex min-w-0 items-center text-sm hover:underline pointer-coarse:min-h-tap"
                      >
                        <span className="truncate">{c.task.title}</span>
                      </Link>
                      <p className="truncate text-caption text-muted-foreground">
                        {[c.task.project?.name, ...c.reasons.map((r) => r.label)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Link
                      href={focusHref(c.task)}
                      aria-label={`Start focus on “${c.task.title}”`}
                      className={buttonClass({
                        variant: "ghost",
                        size: "icon",
                        className: "shrink-0 pointer-coarse:size-tap",
                      })}
                    >
                      <Play aria-hidden className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 font-serif text-2xl leading-tight font-medium sm:text-display">
            Nothing is pressing right now.
          </p>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            No priorities set for today, nothing overdue, and nothing due today. Choose what matters
            on Today, or start an open focus session.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/today" className={buttonClass({ className: actionSize })}>
              Set today&apos;s priorities
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/focus"
              className={buttonClass({ variant: "secondary", className: actionSize })}
            >
              <Play aria-hidden className="size-4" />
              Start focus
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
