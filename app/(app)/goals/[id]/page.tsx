import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GoalMeters } from "@/components/goals/goal-card";
import {
  DeleteGoalButton,
  GoalCurrentValue,
  GoalDetailsForm,
  GoalStatusSelect,
  GoalTextField,
} from "@/components/goals/goal-editors";
import { GoalLinkPicker, UnlinkFromGoal } from "@/components/goals/goal-links";
import { MilestoneList } from "@/components/goals/milestone-list";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";
import { ProgressBar } from "@/components/ui/progress-bar";
import { isGoalOverdue } from "@/features/goals/logic";
import { loadGoalDetail } from "@/features/goals/queries";
import { loadLookups } from "@/features/tasks/queries";
import { loadVisionCards } from "@/features/vision/queries";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = { title: "Goal" };

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getWorkspaceContext();
  const lookups = await loadLookups(ctx);
  const [detail, cards] = await Promise.all([
    loadGoalDetail(ctx, id, lookups),
    loadVisionCards(ctx, { goal: id }),
  ]);
  if (!detail) notFound();
  const { goal, milestones, progress, projects, tasks } = detail;
  const linkedIds = [...projects.map((p) => p.id), ...tasks.map((t) => t.id)];
  const empty = progress.milestones.total === 0 && !progress.measure && progress.work.total === 0;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/goals" className="text-muted-foreground hover:underline">
            ← Goals
          </Link>
        </p>
        <GoalTextField
          goalId={goal.id}
          field="title"
          value={goal.title}
          label="Goal"
          placeholder="Name the goal"
          maxLength={200}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2">
          <GoalStatusSelect goalId={goal.id} status={goal.status} />
          {goal.target_date && (
            <span
              className={cn(
                "text-sm",
                isGoalOverdue(goal, ctx.today)
                  ? "text-red-700 dark:text-red-400"
                  : "text-muted-foreground",
              )}
            >
              Target {formatDate(goal.target_date)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <GoalTextField
            goalId={goal.id}
            field="why"
            value={goal.why}
            label="Why it matters"
            placeholder="The reason you'll come back to when it gets hard…"
            multiline
            maxLength={2000}
          />

          <section aria-labelledby="goal-milestones">
            <h2 id="goal-milestones" className="mb-1 text-sm font-semibold">
              Milestones
            </h2>
            <MilestoneList goalId={goal.id} milestones={milestones} />
          </section>

          <section aria-labelledby="goal-work">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 id="goal-work" className="text-sm font-semibold">
                Projects and tasks
              </h2>
              <GoalLinkPicker goalId={goal.id} linkedIds={linkedIds} />
            </div>
            {projects.length === 0 && tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Link the projects and tasks that move this goal forward. Their progress counts here.
              </p>
            ) : (
              <ul aria-label="Linked work" className="divide-y divide-border">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-start gap-2.5 py-2">
                    <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-sm bg-accent" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${p.id}`} className="text-sm hover:underline">
                        {p.name}
                      </Link>{" "}
                      <span className="text-xs text-muted-foreground">(project)</span>
                      {p.progress.total > 0 && (
                        <div className="mt-1 max-w-56">
                          <ProgressBar progress={p.progress} label={`${p.name} progress`} />
                        </div>
                      )}
                    </div>
                    <UnlinkFromGoal kind="project" targetId={p.id} label={p.name} />
                  </li>
                ))}
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2.5 py-2">
                    <div className="pt-0.5">
                      <TaskCheckbox taskId={t.id} title={t.title} status={t.status} />
                    </div>
                    <Link
                      href={`/tasks/${t.id}`}
                      className={cn(
                        "min-w-0 flex-1 text-sm hover:underline",
                        t.status === "done" && "text-muted-foreground line-through",
                      )}
                    >
                      {t.title}
                    </Link>
                    <UnlinkFromGoal kind="task" targetId={t.id} label={t.title} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="goal-vision">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 id="goal-vision" className="text-sm font-semibold">
                Vision
              </h2>
              <Link
                href={`/goals/vision?goal=${goal.id}`}
                className="text-sm text-accent hover:underline"
              >
                {cards.length ? "Open on the board" : "Add to the vision board"}
              </Link>
            </div>
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No vision cards for this goal yet: a picture or a few words that keep it vivid.
              </p>
            ) : (
              <ul aria-label="Vision cards" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {cards.slice(0, 8).map((c) => (
                  <li
                    key={c.id}
                    className="overflow-hidden rounded-md border border-border bg-surface"
                  >
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private signed URL
                      <img
                        src={c.image_url}
                        alt={c.image_alt ?? ""}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <p className="flex aspect-square items-center justify-center p-2 text-center text-xs break-words">
                        {c.title ?? c.body}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <GoalTextField
            goalId={goal.id}
            field="description"
            value={goal.description}
            label="Notes"
            placeholder="Anything else about this goal…"
            multiline
            maxLength={5000}
          />
        </div>

        <aside aria-label="Goal progress and details" className="space-y-6">
          <section aria-labelledby="goal-progress" className="space-y-2">
            <h2 id="goal-progress" className="text-sm font-semibold">
              Progress
            </h2>
            {empty ? (
              <p className="text-sm text-muted-foreground">
                Nothing to measure yet: add milestones, a measurable target, or linked work.
              </p>
            ) : (
              <GoalMeters goal={{ title: goal.title, progress }} />
            )}
            {progress.measure && (
              <GoalCurrentValue
                goalId={goal.id}
                current={goal.current_value}
                target={progress.measure.target}
                unit={goal.unit}
              />
            )}
          </section>
          <section
            aria-labelledby="goal-details"
            className="rounded-lg border border-border bg-surface p-4"
          >
            <h2 id="goal-details" className="mb-3 text-sm font-semibold">
              Details
            </h2>
            <GoalDetailsForm goal={goal} areas={lookups.areas} />
          </section>
          <DeleteGoalButton goalId={goal.id} title={goal.title} />
        </aside>
      </div>
    </div>
  );
}
