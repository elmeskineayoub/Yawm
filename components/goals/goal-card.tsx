import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { GOAL_STATUSES, isGoalOverdue } from "@/features/goals/logic";
import type { GoalSummary } from "@/features/goals/queries";
import { formatDate, type IsoDate } from "@/lib/dates";

function Meter({ label, percent, text }: { label: string; percent: number; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={text}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{text}</span>
    </div>
  );
}

/** Progress signals shown separately: milestones, the measurable target, and linked work. */
export function GoalMeters({ goal }: { goal: Pick<GoalSummary, "title" | "progress"> }) {
  const { milestones, measure, work } = goal.progress;
  return (
    <div className="space-y-1.5">
      {milestones.total > 0 && (
        <Meter
          label={`${goal.title}: milestones`}
          percent={milestones.percent}
          text={`${milestones.done}/${milestones.total} milestones`}
        />
      )}
      {measure && (
        <Meter
          label={`${goal.title}: target`}
          percent={measure.percent}
          text={`${measure.current}/${measure.target}${measure.unit ? ` ${measure.unit}` : ""}`}
        />
      )}
      {work.total > 0 && (
        <Meter
          label={`${goal.title}: linked tasks`}
          percent={work.percent}
          text={`${work.done}/${work.total} tasks`}
        />
      )}
    </div>
  );
}

/** The single most telling progress signal for a list row: milestones, then target, then work. */
function primaryMeter(goal: GoalSummary) {
  const { milestones, measure, work } = goal.progress;
  if (milestones.total > 0) {
    return {
      label: `${goal.title}: milestones`,
      percent: milestones.percent,
      text: `${milestones.done}/${milestones.total} milestones`,
    };
  }
  if (measure) {
    return {
      label: `${goal.title}: target`,
      percent: measure.percent,
      text: `${measure.current}/${measure.target}${measure.unit ? ` ${measure.unit}` : ""}`,
    };
  }
  if (work.total > 0) {
    return {
      label: `${goal.title}: linked tasks`,
      percent: work.percent,
      text: `${work.done}/${work.total} tasks`,
    };
  }
  return null;
}

/**
 * One goal in the list: name, status and target date, its next milestone (what to do next), and
 * one progress bar. The goal page shows every signal.
 */
export function GoalRow({ goal, today }: { goal: GoalSummary; today: IsoDate }) {
  const overdue = isGoalOverdue(goal, today);
  const meter = primaryMeter(goal);
  const nextOverdue = goal.next?.due_date != null && goal.next.due_date < today;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            data-nav-item
            href={`/goals/${goal.id}`}
            className="min-w-0 text-sm font-medium break-words hover:underline"
          >
            {goal.title}
          </Link>
          {goal.status !== "active" && (
            <Badge tone={goal.status === "achieved" ? "success" : "neutral"}>
              {GOAL_STATUSES.find((s) => s.value === goal.status)?.label ?? goal.status}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {goal.next ? (
            <>
              Next: <span className="text-foreground">{goal.next.title}</span>
              {goal.next.due_date && (
                <span className={nextOverdue ? "text-danger" : undefined}>
                  {" "}
                  · {nextOverdue ? "was due " : ""}
                  {formatDate(goal.next.due_date, "short")}
                </span>
              )}
            </>
          ) : goal.status === "achieved" ? (
            "Achieved"
          ) : goal.progress.milestones.total > 0 ? (
            "All milestones done"
          ) : (
            "No milestones yet"
          )}
          {goal.target_date && (
            <span className={overdue ? "text-danger" : undefined}>
              {" "}
              · {overdue ? "past target " : "by "}
              {formatDate(goal.target_date, "short")}
            </span>
          )}
          {goal.projectCount > 0 &&
            ` · ${goal.projectCount} project${goal.projectCount === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="self-center">
        {meter ? (
          <Meter label={meter.label} percent={meter.percent} text={meter.text} />
        ) : (
          <span className="text-xs text-muted-foreground">Nothing to measure yet</span>
        )}
      </div>
    </li>
  );
}
