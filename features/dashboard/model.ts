import type { ProjectFocusTotals } from "@/features/focus/logic";
import type { FocusSummary } from "@/features/focus/queries";
import type { GoalSummary, MilestoneDue } from "@/features/goals/queries";
import { isDone, streakText } from "@/features/habits/logic";
import type { HabitSummary } from "@/features/habits/queries";
import type { ProjectSummary } from "@/features/projects/queries";
import { ratePercent } from "@/features/reviews/logic";
import { PRIORITY_LABELS, isOpen, type TaskPriority } from "@/features/tasks/logic";
import type { AreaLite, TaskView } from "@/features/tasks/queries";
import type { TodayData } from "@/features/tasks/today";
import { addDays, relativeDateLabel, type IsoDate } from "@/lib/dates";
import { instantToLocal } from "@/lib/dates/zoned";
import { summarizeOverview, type DaySeconds } from "./logic";
import type { DashboardInsights } from "./queries";

/**
 * The Dashboard's view model, derived from loaded records only. Everything shown is computed here
 * (no stored statistics), so the same records always give the same, mutually consistent figures,
 * and the page component stays presentational.
 */

export type DashboardInput = {
  today: IsoDate;
  timezone: string;
  /** Epoch ms; decides which time blocks are past. */
  now: number;
  day: Pick<
    TodayData,
    | "priorities"
    | "scheduled"
    | "overdue"
    | "dueToday"
    | "upcoming"
    | "completedToday"
    | "completedThisWeek"
  >;
  inbox: number;
  areas: AreaLite[];
  projects: ProjectSummary[];
  /** Focus totals per project; empty when project tracking is unavailable. */
  projectFocus: Record<string, ProjectFocusTotals>;
  goals: GoalSummary[];
  /** Null when the sections that need them are hidden. */
  habits: HabitSummary[] | null;
  focus: FocusSummary | null;
  insights: DashboardInsights | null;
  milestones: MilestoneDue[] | null;
  weekTheme: string | null;
};

export type ReasonTone = "danger" | "warning" | "neutral";
export type NextUpReason = { label: string; tone: ReasonTone };
export type NextUpCandidate = { task: TaskView; reasons: NextUpReason[] };

export type HabitLine = {
  id: string;
  title: string;
  done: boolean;
  rest: boolean;
  /** "12/20 pages" for measurable, "2/3 this week" for weekly; null for a plain daily check. */
  progress: string | null;
  /** "12-day streak" (spoken and in the tooltip). */
  streak: string;
  /** "12d", "3w", or "—" (shown in the narrow column). */
  streakShort: string;
};

export type ProjectLine = {
  id: string;
  name: string;
  area: { name: string; color: string } | null;
  percent: number;
  done: number;
  total: number;
  openTasks: number;
  dueDate: IsoDate | null;
  dueTone: ReasonTone;
  focusWeekSeconds: number;
  next: { id: string; title: string } | null;
};

export type GoalLine = {
  id: string;
  title: string;
  targetDate: IsoDate | null;
  percent: number;
  progressLabel: string;
  next: { title: string; dueDate: IsoDate | null } | null;
};

export type FocusDay = DaySeconds & { isToday: boolean; isFuture: boolean };

export type DashboardModel = {
  summary: string;
  nextUp: { primary: NextUpCandidate | null; then: NextUpCandidate[] };
  attention: {
    overdue: TaskView[];
    dueToday: TaskView[];
    /** Open tasks due in the next 7 days (after today). */
    upcoming: TaskView[];
    milestones: MilestoneDue[];
    inbox: number;
  };
  today: {
    dueToday: number;
    overdue: number;
    completed: number;
    habitsDone: number | null;
    habitsDue: number | null;
    focusSeconds: number;
    focusSessions: number;
    blocks: number;
    nextBlock: { title: string; start: string; end: string } | null;
  };
  habits: HabitLine[] | null;
  week: {
    theme: string | null;
    completed: number;
    taskRate: number | null;
    habitRate: number | null;
    focusSeconds: number;
    focusByDay: FocusDay[] | null;
  };
  projects: ProjectLine[];
  goals: GoalLine[];
};

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const UPCOMING_DAYS = 7;
const THEN_COUNT = 2;

function byUrgency(a: TaskView, b: TaskView): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    (a.due_time ?? "99").localeCompare(b.due_time ?? "99") ||
    a.title.localeCompare(b.title)
  );
}

/**
 * What to work on next, in a fixed order the user can predict: today's chosen priorities first (in
 * plan order), then overdue work, then work due today (each by priority), then tasks attached to a
 * time block still ahead today. A task blocked by unfinished dependencies goes last.
 */
export function pickNextUp(input: DashboardInput): DashboardModel["nextUp"] {
  const { day, today, timezone, now } = input;
  const priorityIds = new Set<string>();
  const ordered: TaskView[] = [];
  const seen = new Set<string>();
  const push = (task: TaskView) => {
    if (seen.has(task.id) || !isOpen(task.status)) return;
    seen.add(task.id);
    ordered.push(task);
  };

  for (const item of day.priorities) {
    if (item.kind !== "task") continue;
    priorityIds.add(item.task.id);
    push(item.task);
  }
  [...day.overdue].sort(byUrgency).forEach(push);
  [...day.dueToday].sort(byUrgency).forEach(push);

  const blockAt = new Map<string, string>();
  const known = new Map(
    [...day.overdue, ...day.dueToday, ...day.upcoming].map((t) => [t.id, t] as const),
  );
  for (const block of [...day.scheduled].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    if (!block.task_id || Date.parse(block.ends_at) <= now) continue;
    if (!blockAt.has(block.task_id)) {
      blockAt.set(block.task_id, instantToLocal(block.starts_at, timezone).time);
    }
    const task = known.get(block.task_id);
    if (task) push(task);
  }

  const blocked = ordered.filter((t) => t.openBlockers > 0);
  const ready = ordered.filter((t) => t.openBlockers === 0);
  const candidates = [...ready, ...blocked].map((task) => ({
    task,
    reasons: reasonsFor(task, { today, isPriority: priorityIds.has(task.id), blockAt }),
  }));
  return { primary: candidates[0] ?? null, then: candidates.slice(1, 1 + THEN_COUNT) };
}

function reasonsFor(
  task: TaskView,
  {
    today,
    isPriority,
    blockAt,
  }: { today: IsoDate; isPriority: boolean; blockAt: Map<string, string> },
): NextUpReason[] {
  const reasons: NextUpReason[] = [];
  if (isPriority) reasons.push({ label: "Today's priority", tone: "neutral" });
  if (task.due_date && task.due_date < today) {
    reasons.push({ label: `Overdue · ${relativeDateLabel(task.due_date, today)}`, tone: "danger" });
  } else if (task.due_date === today) {
    const at = task.due_time ? ` ${task.due_time.slice(0, 5)}` : "";
    reasons.push({ label: `Due today${at}`, tone: "warning" });
  }
  if (task.priority === "urgent" || task.priority === "high") {
    reasons.push({
      label: PRIORITY_LABELS[task.priority],
      tone: task.priority === "urgent" ? "danger" : "warning",
    });
  }
  const at = blockAt.get(task.id);
  if (at) reasons.push({ label: `Scheduled ${at}`, tone: "neutral" });
  if (task.openBlockers > 0) {
    reasons.push({ label: `Blocked by ${task.openBlockers}`, tone: "warning" });
  }
  return reasons;
}

function habitLines(habits: HabitSummary[]): HabitLine[] {
  return habits.map(({ habit, log, streaks, week }) => {
    let progress: string | null = null;
    if (week) progress = `${week.done}/${week.target} this week`;
    else if (habit.kind === "measurable" && habit.target_value !== null) {
      progress = `${log?.value ?? 0}/${habit.target_value}${habit.unit ? ` ${habit.unit}` : ""}`;
    }
    return {
      id: habit.id,
      title: habit.title,
      done: isDone(habit, log ?? undefined),
      rest: Boolean(log?.rest),
      progress,
      streak: streakText(streaks),
      streakShort:
        streaks.current === 0 ? "—" : `${streaks.current}${streaks.unit === "day" ? "d" : "w"}`,
    };
  });
}

function goalLine(goal: GoalSummary): GoalLine {
  const { measure, milestones, work } = goal.progress;
  let percent = work.percent;
  let progressLabel = `${work.done} of ${work.total} tasks`;
  if (measure) {
    percent = measure.percent;
    progressLabel = `${measure.current}/${measure.target}${measure.unit ? ` ${measure.unit}` : ""}`;
  } else if (milestones.total > 0) {
    percent = milestones.percent;
    progressLabel = `${milestones.done} of ${milestones.total} milestones`;
  }
  return {
    id: goal.id,
    title: goal.title,
    targetDate: goal.target_date,
    percent,
    progressLabel,
    next: goal.next ? { title: goal.next.title, dueDate: goal.next.due_date } : null,
  };
}

export function buildDashboardModel(input: DashboardInput): DashboardModel {
  const { day, today, now } = input;
  const horizon = addDays(today, UPCOMING_DAYS);
  const upcoming = day.upcoming
    .filter((t) => t.due_date! > today && t.due_date! <= horizon)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || byUrgency(a, b));
  const habits = input.habits ? habitLines(input.habits) : null;
  const nextBlock = [...day.scheduled]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .find((b) => Date.parse(b.ends_at) > now);

  const focusByDay = input.insights
    ? input.insights.focusByDay.map((d) => ({
        ...d,
        isToday: d.date === today,
        isFuture: d.date > today,
      }))
    : null;
  // The week's total is the sum of its days whenever the per-day figures exist, so the two agree.
  const focusWeekSeconds = focusByDay
    ? focusByDay.reduce((sum, d) => sum + d.seconds, 0)
    : (input.focus?.weekSeconds ?? 0);

  // A project's next deadline among the open work already loaded (overdue, today, next days).
  const dated = [...day.overdue, ...day.dueToday, ...day.upcoming].sort(
    (a, b) => a.due_date!.localeCompare(b.due_date!) || byUrgency(a, b),
  );
  const areaById = new Map(input.areas.map((a) => [a.id, a]));

  return {
    summary: summarizeOverview({
      overdue: day.overdue.length,
      completedThisWeek: day.completedThisWeek,
      activeProjects: input.projects.length,
      activeGoals: input.goals.length,
      inbox: input.inbox,
    }),
    nextUp: pickNextUp(input),
    attention: {
      overdue: [...day.overdue].sort(byUrgency),
      dueToday: [...day.dueToday].sort(byUrgency),
      upcoming,
      milestones: (input.milestones ?? []).filter((m) => !m.completed_at),
      inbox: input.inbox,
    },
    today: {
      dueToday: day.dueToday.length,
      overdue: day.overdue.length,
      completed: day.completedToday.length,
      habitsDone: habits ? habits.filter((h) => h.done).length : null,
      habitsDue: habits ? habits.length : null,
      focusSeconds: input.focus?.todaySeconds ?? 0,
      focusSessions: input.focus?.todayCount ?? 0,
      blocks: day.scheduled.length,
      nextBlock: nextBlock
        ? { title: nextBlock.title, start: nextBlock.starts_at, end: nextBlock.ends_at }
        : null,
    },
    habits,
    week: {
      theme: input.weekTheme,
      completed: day.completedThisWeek,
      taskRate: input.insights?.weekTaskRate ?? null,
      habitRate: input.insights ? ratePercent(input.insights.habits.rate) : null,
      focusSeconds: focusWeekSeconds,
      focusByDay,
    },
    projects: input.projects.map((p) => {
      const area = p.area_id ? areaById.get(p.area_id) : undefined;
      const next = dated.find((t) => t.project?.id === p.id);
      return {
        id: p.id,
        name: p.name,
        area: area ? { name: area.name, color: area.color } : null,
        percent: p.progress.percent,
        done: p.progress.done,
        total: p.progress.total,
        openTasks: p.openTasks,
        dueDate: p.due_date,
        dueTone: !p.due_date
          ? "neutral"
          : p.due_date < today
            ? "danger"
            : p.due_date <= horizon
              ? "warning"
              : "neutral",
        focusWeekSeconds: input.projectFocus[p.id]?.weekSeconds ?? 0,
        next: next ? { id: next.id, title: next.title } : null,
      };
    }),
    goals: input.goals.map(goalLine),
  };
}
