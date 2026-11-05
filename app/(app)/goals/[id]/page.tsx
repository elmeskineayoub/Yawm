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
import { PageHeader } from "@/components/layout/page-header";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Section } from "@/components/ui/section";
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

  const area = lookups.areas.find((a) => a.id === goal.area_id) ?? null;
  return (
    <>
      <PageHeader
        title={goal.title}
        breadcrumb={[
          {
            label: "Goals & Vision",
            href: goal.status === "archived" ? "/goals?status=archived" : "/goals",
          },
        ]}
        meta={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <GoalStatusSelect goalId={goal.id} status={goal.status} />
            {area && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full ring-1 ring-foreground/20 ring-inset"
                  style={{ backgroundColor: area.color }}
                />
                {area.name}
              </span>
            )}
            {goal.target_date && (
              <span className={cn(isGoalOverdue(goal, ctx.today) && "text-danger")}>
                Target {formatDate(goal.target_date)}
              </span>
            )}
          </span>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <GoalTextField
            goalId={goal.id}
            field="why"
            value={goal.why}
            label="Why it matters"
            placeholder="The reason you'll come back to when it gets hard…"
            multiline
            maxLength={2000}
          />

          <Section
            title="Milestones"
            count={
              progress.milestones.total
                ? `${progress.milestones.done}/${progress.milestones.total}`
                : undefined
            }
          >
            <MilestoneList goalId={goal.id} milestones={milestones} />
          </Section>

          <Section
            title="Projects and tasks"
            divider
            actions={<GoalLinkPicker goalId={goal.id} linkedIds={linkedIds} />}
          >
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
          </Section>

          <Section
            title="Vision"
            divider
            actions={
              <Link
                href={`/goals/vision?goal=${goal.id}`}
                className="text-sm text-accent hover:underline"
              >
                {cards.length ? "Open on the board" : "Add to the vision board"}
              </Link>
            }
          >
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
          </Section>

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

        <aside aria-label="Goal progress and details" className="min-w-0 space-y-8">
          <Section title="Progress" variant="label">
            {empty ? (
              <p className="text-sm text-muted-foreground">
                Nothing to measure yet: add milestones, a measurable target, or linked work.
              </p>
            ) : (
              <GoalMeters goal={{ title: goal.title, progress }} />
            )}
            {progress.measure && (
              <div className="mt-3">
                <GoalCurrentValue
                  goalId={goal.id}
                  current={goal.current_value}
                  target={progress.measure.target}
                  unit={goal.unit}
                />
              </div>
            )}
          </Section>
          <Section title="Details" variant="label" divider>
            <div className="space-y-4">
              <GoalTextField
                goalId={goal.id}
                field="title"
                value={goal.title}
                label="Name"
                placeholder="Name the goal"
                maxLength={200}
              />
              <GoalDetailsForm goal={goal} areas={lookups.areas} />
            </div>
          </Section>
          <div className="border-t border-border pt-6">
            <DeleteGoalButton goalId={goal.id} title={goal.title} />
          </div>
        </aside>
      </div>
    </>
  );
}
