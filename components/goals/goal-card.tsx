import Link from "next/link";
import { isGoalOverdue } from "@/features/goals/logic";
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

export function GoalCard({
  goal,
  areaName,
  today,
}: {
  goal: GoalSummary;
  areaName: string | null;
  today: IsoDate;
}) {
  const overdue = isGoalOverdue(goal, today);
  const empty =
    goal.progress.milestones.total === 0 &&
    !goal.progress.measure &&
    goal.progress.work.total === 0;
  return (
    <li>
      <Link
        href={`/goals/${goal.id}`}
        className="block h-full space-y-2 rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted"
      >
        <div>
          <p className="font-medium break-words">{goal.title}</p>
          <p className="text-xs text-muted-foreground">
            {[
              areaName,
              goal.target_date && `by ${formatDate(goal.target_date, "short")}`,
              goal.projectCount > 0 &&
                `${goal.projectCount} project${goal.projectCount === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ") || "No target date"}
            {overdue && <span className="text-red-700 dark:text-red-400"> · past target date</span>}
          </p>
        </div>
        {goal.why && (
          <p className="line-clamp-2 text-sm text-muted-foreground italic">{goal.why}</p>
        )}
        {empty ? (
          <p className="text-xs text-muted-foreground">
            Add milestones or link projects to see progress.
          </p>
        ) : (
          <GoalMeters goal={goal} />
        )}
        {goal.next && (
          <p className="text-xs">
            <span className="text-muted-foreground">Next: </span>
            {goal.next.title}
            {goal.next.due_date && (
              <span className="text-muted-foreground">
                {" "}
                · {formatDate(goal.next.due_date, "short")}
              </span>
            )}
          </p>
        )}
      </Link>
    </li>
  );
}
