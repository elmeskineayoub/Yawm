/**
 * A deterministic, synthetic workspace for designing and testing the Dashboard. No real personal
 * data: every name below is invented.
 *
 * Only raw records are written by hand (tasks, projects, habits and their logs, goals and
 * milestones, focus sessions, time blocks, the day plan). Every summary the Dashboard shows is then
 * derived from those records with the same pure functions the live queries use (progressOf,
 * goalProgress, summarizeHabit, completionRate, deriveInsights, aggregateProjectFocus, …), so the
 * figures are consistent by construction. Nothing here touches a database.
 *
 * The moment is fixed: Wednesday 11 November 2026, 10:40 in Europe/Amsterdam, weeks starting Monday.
 */
import type { CalendarBlock } from "@/features/calendar/queries";
import type { DashboardInput } from "@/features/dashboard/model";
import { deriveInsights } from "@/features/dashboard/queries";
import { aggregateProjectFocus, totalFocusSeconds, type FocusPhase } from "@/features/focus/logic";
import type { FocusSummary } from "@/features/focus/queries";
import { goalProgress, nextMilestone } from "@/features/goals/logic";
import type { GoalSummary, Milestone, MilestoneDue } from "@/features/goals/queries";
import { completionRate, type HabitLog } from "@/features/habits/logic";
import { summarizeHabit, type Habit } from "@/features/habits/queries";
import type { ProjectSummary } from "@/features/projects/queries";
import { isOpen, progressOf, type TaskPriority, type TaskStatus } from "@/features/tasks/logic";
import type { AreaLite, TaskView } from "@/features/tasks/queries";
import { addDays, dateOfInstant, periodStart, type IsoDate } from "@/lib/dates";
import { localToInstant, zonedDayRange, zonedRange } from "@/lib/dates/zoned";

export const FIXTURE_TODAY: IsoDate = "2026-11-11";
export const FIXTURE_TIMEZONE = "Europe/Amsterdam";
export const FIXTURE_WEEK_START = 1;
const TZ = FIXTURE_TIMEZONE;
const at = (date: IsoDate, time: string) => localToInstant(date, time, TZ);
export const FIXTURE_NOW = Date.parse(at(FIXTURE_TODAY, "10:40"));

/** Stable UUIDs: a prefix per kind and a running number. */
const uuid = (kind: number, n: number) =>
  `00000000-0000-4000-8${kind.toString(16).padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

// ---------------------------------------------------------------------------------------------
// Areas and projects

const areas: AreaLite[] = [
  { id: uuid(1, 1), name: "Work", color: "#6b7a8f", archived_at: null },
  { id: uuid(1, 2), name: "Study", color: "#9a8461", archived_at: null },
  { id: uuid(1, 3), name: "Health", color: "#5e7d63", archived_at: null },
  { id: uuid(1, 4), name: "Personal", color: "#8a6f78", archived_at: null },
];
const [WORK, STUDY, HEALTH, PERSONAL] = areas as [AreaLite, AreaLite, AreaLite, AreaLite];

type ProjectRecord = {
  id: string;
  name: string;
  area: AreaLite;
  due_date: IsoDate | null;
  goal_id: string | null;
};

const GOAL_THESIS = uuid(5, 1);
const GOAL_RUN = uuid(5, 2);
const GOAL_CUSTOMERS = uuid(5, 3);

const projectRecords: ProjectRecord[] = [
  {
    id: uuid(2, 1),
    name: "Pricing page relaunch",
    area: WORK,
    due_date: "2026-11-20",
    goal_id: GOAL_CUSTOMERS,
  },
  {
    id: uuid(2, 2),
    name: "Thesis chapter 3",
    area: STUDY,
    due_date: "2026-12-15",
    goal_id: GOAL_THESIS,
  },
  {
    id: uuid(2, 3),
    name: "Half-marathon training",
    area: HEALTH,
    due_date: "2027-04-12",
    goal_id: GOAL_RUN,
  },
  {
    id: uuid(2, 4),
    name: "Client site: Northfield Bakery",
    area: WORK,
    due_date: "2026-11-13",
    goal_id: null,
  },
  { id: uuid(2, 5), name: "Home office setup", area: PERSONAL, due_date: null, goal_id: null },
];
const [PRICING, THESIS, RUNNING, CLIENT, OFFICE] = projectRecords as [
  ProjectRecord,
  ProjectRecord,
  ProjectRecord,
  ProjectRecord,
  ProjectRecord,
];

// ---------------------------------------------------------------------------------------------
// Tasks: 25 open (2 overdue, 3 due today, 6 in the next 7 days, 14 later or undated), 29 done.

type TaskSpec = {
  title: string;
  project?: ProjectRecord;
  area?: AreaLite;
  priority?: TaskPriority;
  status?: TaskStatus;
  due?: IsoDate;
  dueTime?: string;
  estimate?: number;
  completedAt?: string;
  blockers?: number;
};

let taskNumber = 0;
function task(spec: TaskSpec): TaskView {
  taskNumber += 1;
  const area = spec.area ?? spec.project?.area ?? null;
  return {
    id: uuid(3, taskNumber),
    title: spec.title,
    description: null,
    status: spec.status ?? "todo",
    priority: spec.priority ?? "medium",
    due_date: spec.due ?? null,
    due_time: spec.dueTime ?? null,
    estimate_minutes: spec.estimate ?? null,
    project_id: spec.project?.id ?? null,
    area_id: area?.id ?? null,
    parent_task_id: null,
    sort_order: taskNumber,
    completed_at: spec.completedAt ?? null,
    created_at: "2026-10-01T08:00:00.000Z",
    recurrence_frequency: null,
    recurrence_interval: 1,
    recurrence_weekdays: null,
    recurrence_until: null,
    recurrence_anchor: null,
    project: spec.project
      ? { id: spec.project.id, name: spec.project.name, status: "active" }
      : null,
    area,
    tags: [],
    subtasks: { total: 0, done: 0 },
    openBlockers: spec.blockers ?? 0,
  };
}

const openTasks: TaskView[] = [
  // Overdue
  task({
    title: "Send revised quote to Northfield",
    project: CLIENT,
    priority: "high",
    due: "2026-11-09",
    estimate: 20,
  }),
  task({ title: "Book physio follow-up", area: HEALTH, due: "2026-11-07", estimate: 10 }),
  // Due today
  task({
    title: "Finalize pricing tiers copy",
    project: PRICING,
    priority: "urgent",
    status: "in_progress",
    due: FIXTURE_TODAY,
    estimate: 90,
  }),
  task({
    title: "Review chapter 3 outline with supervisor notes",
    project: THESIS,
    priority: "high",
    due: FIXTURE_TODAY,
    dueTime: "16:00:00",
    estimate: 60,
  }),
  task({ title: "Pay studio rent", area: PERSONAL, due: FIXTURE_TODAY, estimate: 10 }),
  // Next 7 days
  task({ title: "Export hero illustrations", project: PRICING, due: "2026-11-12", estimate: 30 }),
  task({
    title: "Migrate menu page to the CMS",
    project: CLIENT,
    priority: "high",
    due: "2026-11-13",
    estimate: 120,
  }),
  task({ title: "Long run, 14 km", project: RUNNING, due: "2026-11-15", estimate: 85 }),
  task({
    title: "Draft section 3.2 on methods",
    project: THESIS,
    due: "2026-11-16",
    estimate: 120,
  }),
  task({
    title: "QA checkout on mobile",
    project: PRICING,
    due: "2026-11-17",
    estimate: 45,
    blockers: 1,
  }),
  task({ title: "Order a monitor arm", project: OFFICE, priority: "low", due: "2026-11-18" }),
  // Later or undated
  task({ title: "Write FAQ entries", project: PRICING, due: "2026-11-24", estimate: 60 }),
  task({ title: "Set up the A/B test", project: PRICING, priority: "low" }),
  task({ title: "Collect sources for section 3.3", project: THESIS }),
  task({ title: "Rewrite the introduction paragraph", project: THESIS }),
  task({ title: "Format the bibliography", project: THESIS, priority: "low", due: "2026-12-01" }),
  task({ title: "Buy new running shoes", project: RUNNING, priority: "low" }),
  task({ title: "Plan interval sessions for December", project: RUNNING }),
  task({ title: "Write handover notes", project: CLIENT, due: "2026-11-27" }),
  task({ title: "Compress gallery images", project: CLIENT, priority: "low" }),
  task({ title: "Cable management under the desk", project: OFFICE, priority: "low" }),
  task({ title: "Choose a desk lamp", project: OFFICE, priority: "low" }),
  task({ title: "Renew passport", area: PERSONAL, due: "2026-12-10" }),
  task({ title: "Call grandma", area: PERSONAL }),
  task({ title: "Back up the laptop", area: PERSONAL, priority: "low" }),
];

/** Done tasks per project, with completion times spread over the last weeks. */
const completions: { date: IsoDate; time: string; count: number }[] = [
  { date: "2026-10-14", time: "15:00", count: 3 },
  { date: "2026-10-28", time: "11:00", count: 3 },
  { date: "2026-11-05", time: "16:30", count: 3 }, // Thursday last week
  { date: "2026-11-06", time: "14:00", count: 4 },
  { date: "2026-11-07", time: "10:00", count: 1 },
  { date: "2026-11-08", time: "18:00", count: 2 },
  { date: "2026-11-09", time: "13:00", count: 5 }, // Monday this week
  { date: "2026-11-10", time: "15:30", count: 6 },
  { date: FIXTURE_TODAY, time: "09:15", count: 2 }, // before "now"
];
const doneSlots = completions.flatMap((c) =>
  Array.from({ length: c.count }, (_, i) =>
    at(c.date, c.time.replace(/:(\d\d)$/, `:${String(i * 3).padStart(2, "0")}`)),
  ),
);
const donePlan: [ProjectRecord, number][] = [
  [PRICING, 8],
  [THESIS, 4],
  [RUNNING, 6],
  [CLIENT, 9],
  [OFFICE, 2],
];
// Interleave projects so every day mixes work from several projects.
const doneOwners: ProjectRecord[] = [];
for (let round = 0; doneOwners.length < 29; round++) {
  for (const [project, count] of donePlan) if (round < count) doneOwners.push(project);
}
const doneTasks: TaskView[] = doneOwners.map((project, i) =>
  task({
    title: `Finished step ${i + 1} for ${project.name}`,
    project,
    status: "done",
    completedAt: doneSlots[i]!,
  }),
);

export const fixtureTasks = { open: openTasks, done: doneTasks };
const allTasks = [...openTasks, ...doneTasks];
const byTitle = (title: string) => openTasks.find((t) => t.title === title)!;

// ---------------------------------------------------------------------------------------------
// Habits and logs

type HabitSpec = Omit<Habit, "id" | "description" | "area_id" | "archived_at" | "sort_order"> & {
  logs: HabitLog[];
};

const days = (from: IsoDate, to: IsoDate) => {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
const yesterday = addDays(FIXTURE_TODAY, -1);
const isWeekday = (d: IsoDate) => {
  const w = new Date(`${d}T12:00:00Z`).getUTCDay();
  return w >= 1 && w <= 5;
};

const habitSpecs: HabitSpec[] = [
  {
    title: "Morning pages",
    kind: "boolean",
    target_value: null,
    unit: null,
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    times_per_week: null,
    starts_on: "2026-09-01",
    ends_on: null,
    logs: days("2026-10-20", FIXTURE_TODAY).map((d) => ({ log_date: d, value: 1, rest: false })),
  },
  {
    title: "Read",
    kind: "measurable",
    target_value: 20,
    unit: "pages",
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    times_per_week: null,
    starts_on: "2026-09-01",
    ends_on: null,
    logs: [
      ...days("2026-10-20", "2026-10-31").map((d) => ({ log_date: d, value: 24, rest: false })),
      // 1 November missed; a nine-day run since, and 12 of 20 pages so far today.
      ...days("2026-11-02", yesterday).map((d) => ({ log_date: d, value: 22, rest: false })),
      { log_date: FIXTURE_TODAY, value: 12, rest: false },
    ],
  },
  {
    title: "Meditate",
    kind: "boolean",
    target_value: null,
    unit: null,
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5],
    times_per_week: null,
    starts_on: "2026-09-01",
    ends_on: null,
    logs: days("2026-10-26", yesterday)
      .filter(isWeekday)
      .filter((d) => d !== "2026-11-04" && d !== "2026-11-10")
      .map((d) => ({ log_date: d, value: 1, rest: false })),
  },
  {
    title: "Run",
    kind: "boolean",
    target_value: null,
    unit: null,
    frequency: "weekly",
    weekdays: [],
    times_per_week: 3,
    starts_on: "2026-09-01",
    ends_on: null,
    logs: [
      "2026-10-20",
      "2026-10-22",
      "2026-10-25",
      "2026-10-27",
      "2026-10-29",
      "2026-11-01",
      "2026-11-03",
      "2026-11-05",
      "2026-11-08",
      "2026-11-09",
      FIXTURE_TODAY,
    ].map((d) => ({ log_date: d, value: 1, rest: false })),
  },
  {
    title: "No screens after 22:00",
    kind: "boolean",
    target_value: null,
    unit: null,
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    times_per_week: null,
    starts_on: "2026-09-01",
    ends_on: null,
    logs: [
      ...days("2026-10-30", yesterday)
        .filter((d) => d !== "2026-11-07")
        .map((d) => ({ log_date: d, value: 1, rest: false })),
      { log_date: "2026-11-07", value: null, rest: true },
    ],
  },
];

const habits = habitSpecs.map(({ logs, ...rule }, i) => ({
  habit: {
    ...rule,
    id: uuid(4, i + 1),
    description: null,
    area_id: null,
    archived_at: null,
    sort_order: i,
  } as Habit,
  logs,
}));

// ---------------------------------------------------------------------------------------------
// Goals and milestones

const goalRecords = [
  {
    id: GOAL_THESIS,
    title: "Submit the thesis by March",
    target_date: "2027-03-15",
    target_value: null,
    current_value: null,
    unit: null,
  },
  {
    id: GOAL_RUN,
    title: "Run a half marathon",
    target_date: "2027-04-12",
    target_value: 21.1,
    current_value: 14,
    unit: "km longest run",
  },
  {
    id: GOAL_CUSTOMERS,
    title: "Reach 40 paying customers",
    target_date: "2027-06-30",
    target_value: 40,
    current_value: 27,
    unit: "customers",
  },
] as const;

let milestoneNumber = 0;
const milestone = (
  goal_id: string,
  title: string,
  due_date: IsoDate | null,
  done = false,
): Milestone => {
  milestoneNumber += 1;
  return {
    id: uuid(6, milestoneNumber),
    goal_id,
    title,
    due_date,
    completed_at: done ? `${due_date ?? "2026-10-01"}T12:00:00.000Z` : null,
    sort_order: milestoneNumber,
  };
};
const milestones: Milestone[] = [
  milestone(GOAL_THESIS, "Chapter 1 approved", "2026-09-30", true),
  milestone(GOAL_THESIS, "Chapter 2 approved", "2026-10-31", true),
  milestone(GOAL_THESIS, "Chapter 3 draft to supervisor", "2026-11-30"),
  milestone(GOAL_THESIS, "Full draft", "2027-01-31"),
  milestone(GOAL_THESIS, "Submission", "2027-03-15"),
  milestone(GOAL_RUN, "Run 10 km without stopping", "2026-10-18", true),
  milestone(GOAL_RUN, "Run 15 km without stopping", "2026-11-15"),
  milestone(GOAL_RUN, "Race day", "2027-04-12"),
  milestone(GOAL_CUSTOMERS, "Pricing page live", "2026-11-20"),
];

// ---------------------------------------------------------------------------------------------
// Focus sessions (focus and breaks) and today's time blocks

type SessionRecord = {
  id: string;
  session_type: FocusPhase;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  project_id: string | null;
  task_id: string | null;
};
let sessionNumber = 0;
function session(
  date: IsoDate,
  start: string,
  minutes: number,
  project: ProjectRecord | null,
  type: FocusPhase = "focus",
  taskId: string | null = null,
): SessionRecord {
  sessionNumber += 1;
  const started = at(date, start);
  return {
    id: uuid(7, sessionNumber),
    session_type: type,
    started_at: started,
    ended_at: new Date(Date.parse(started) + minutes * 60_000).toISOString(),
    duration_seconds: minutes * 60,
    project_id: project?.id ?? null,
    task_id: taskId,
  };
}
const sessions: SessionRecord[] = [
  // Last week (counts toward all-time project totals only)
  session("2026-11-05", "09:00", 50, THESIS),
  session("2026-11-06", "14:00", 50, PRICING),
  // Monday: 2h 5m
  session("2026-11-09", "08:30", 50, THESIS),
  session("2026-11-09", "09:20", 10, null, "short_break"),
  session("2026-11-09", "09:30", 50, THESIS),
  session("2026-11-09", "14:00", 25, PRICING),
  // Tuesday: 2h 30m
  session("2026-11-10", "09:00", 50, PRICING),
  session("2026-11-10", "10:00", 50, PRICING),
  session("2026-11-10", "13:30", 25, CLIENT),
  session("2026-11-10", "16:00", 25, THESIS),
  // Today so far: 1h 15m
  session(
    FIXTURE_TODAY,
    "08:30",
    50,
    THESIS,
    "focus",
    byTitle("Review chapter 3 outline with supervisor notes").id,
  ),
  session(FIXTURE_TODAY, "09:20", 10, null, "short_break"),
  session(FIXTURE_TODAY, "09:30", 25, PRICING, "focus", byTitle("Finalize pricing tiers copy").id),
];

const block = (
  n: number,
  title: string,
  start: string,
  end: string,
  project: ProjectRecord | null,
  linked?: TaskView,
): CalendarBlock => ({
  id: uuid(8, n),
  title,
  notes: null,
  starts_at: at(FIXTURE_TODAY, start),
  ends_at: at(FIXTURE_TODAY, end),
  timezone: TZ,
  task_id: linked?.id ?? null,
  project_id: project?.id ?? null,
  editable: true,
  task: linked ? { id: linked.id, title: linked.title, status: linked.status } : null,
});
const scheduled: CalendarBlock[] = [
  block(1, "Thesis writing", "08:30", "10:00", THESIS),
  block(2, "Pricing page copy", "11:00", "12:30", PRICING, byTitle("Finalize pricing tiers copy")),
  block(
    3,
    "Northfield review call",
    "15:00",
    "16:00",
    CLIENT,
    byTitle("Send revised quote to Northfield"),
  ),
];

export const FIXTURE_WEEK_THEME = "Ship the pricing page; keep mornings for the thesis.";
export const fixtureInboxIdeas = [
  "Newsletter about the pricing change",
  "Try time-boxed email twice a day",
  "Workshop idea: planning for freelancers",
  "Gift for Sam's birthday",
  "Read up on spaced repetition for thesis notes",
  "Standing desk or not?",
  "Weekend trip in December",
  "Template for client handovers",
  "Podcast episode on deep work",
  "Ask the bakery for a testimonial",
];

// ---------------------------------------------------------------------------------------------
// Derivations (mirroring the live loaders)

function deriveProjects(): ProjectSummary[] {
  return projectRecords.map((p, i) => {
    const tasks = allTasks.filter((t) => t.project_id === p.id);
    return {
      id: p.id,
      name: p.name,
      status: "active",
      due_date: p.due_date,
      area_id: p.area.id,
      sort_order: i,
      goal_id: p.goal_id,
      progress: progressOf(tasks),
      openTasks: tasks.filter((t) => isOpen(t.status)).length,
    };
  });
}

function deriveGoals(): GoalSummary[] {
  return goalRecords.map((g, i) => {
    const goalMilestones = milestones.filter((m) => m.goal_id === g.id);
    const projectIds = new Set(projectRecords.filter((p) => p.goal_id === g.id).map((p) => p.id));
    const tasks = allTasks.filter((t) => t.project_id && projectIds.has(t.project_id));
    return {
      id: g.id,
      title: g.title,
      description: null,
      why: null,
      status: "active",
      area_id: null,
      start_date: "2026-09-01",
      target_date: g.target_date,
      target_value: g.target_value,
      current_value: g.current_value,
      unit: g.unit,
      sort_order: i,
      created_at: "2026-09-01T08:00:00.000Z",
      updated_at: "2026-11-01T08:00:00.000Z",
      progress: goalProgress(g, goalMilestones, tasks),
      next: nextMilestone(goalMilestones),
      projectCount: projectIds.size,
    };
  });
}

/** The Dashboard's full input for the fixed moment, derived from the records above. */
export function dashboardFixture(): DashboardInput {
  const today = FIXTURE_TODAY;
  const weekStartDate = periodStart("week", today, FIXTURE_WEEK_START);
  const weekEnd = addDays(weekStartDate, 6);
  const dayRange = zonedDayRange(today, TZ);
  const weekRange = zonedRange(weekStartDate, addDays(weekStartDate, 7), TZ);
  const inRange = (iso: string, r: { start: string; end: string }) =>
    Date.parse(iso) >= Date.parse(r.start) && Date.parse(iso) < Date.parse(r.end);

  const open = openTasks.filter((t) => isOpen(t.status));
  const due = open.filter((t) => t.due_date && t.due_date <= addDays(today, 8));
  const completedSince = doneTasks.filter(
    (t) => Date.parse(t.completed_at!) >= FIXTURE_NOW - 8 * 86_400_000,
  );
  const completedThisWeek = completedSince.filter(
    (t) => dateOfInstant(t.completed_at!, TZ) >= weekStartDate,
  );

  const habitSummaries = habits
    .map(({ habit, logs }) => summarizeHabit(habit, logs, today, today, FIXTURE_WEEK_START))
    .filter((s) => s.due);

  const weekSessions = sessions.filter((s) => inRange(s.started_at, weekRange));
  const daySessions = weekSessions.filter((s) => inRange(s.started_at, dayRange));
  const focus: FocusSummary = {
    todaySeconds: totalFocusSeconds(daySessions),
    weekSeconds: totalFocusSeconds(weekSessions),
    todayCount: daySessions.filter((s) => s.session_type === "focus").length,
    recent: [...sessions]
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        session_type: s.session_type,
        started_at: s.started_at,
        ended_at: s.ended_at,
        duration_seconds: s.duration_seconds,
        task: s.task_id
          ? { id: s.task_id, title: openTasks.find((t) => t.id === s.task_id)!.title }
          : null,
      })),
  };

  const trendStart = zonedRange(addDays(today, -6), addDays(today, 1), TZ);
  const insights = deriveInsights(
    {
      recentCompletions: doneTasks
        .map((t) => t.completed_at)
        .filter((c): c is string => c !== null && inRange(c, trendStart)),
      weekCompleted: doneTasks.filter((t) => inRange(t.completed_at!, weekRange)).length,
      weekOpenDue: open.filter(
        (t) => t.due_date && t.due_date >= weekStartDate && t.due_date <= weekEnd,
      ).length,
      habitRates: habits.map(({ habit, logs }) => ({
        id: habit.id,
        title: habit.title,
        ...completionRate(habit, logs, weekStartDate, weekEnd, today, FIXTURE_WEEK_START),
      })),
      weekSessions,
    },
    { today, timezone: TZ, weekStart: FIXTURE_WEEK_START },
  );

  const goals = deriveGoals();
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  const milestonesDue: MilestoneDue[] = milestones
    .filter((m) => m.due_date && m.due_date >= today && m.due_date < addDays(today, 8))
    .map((m) => ({ ...m, goal_title: goalTitle.get(m.goal_id)! }));

  const priorities = [
    "Finalize pricing tiers copy",
    "Send revised quote to Northfield",
    "Review chapter 3 outline with supervisor notes",
  ].map((title, i) => ({ id: uuid(9, i + 1), kind: "task" as const, task: byTitle(title) }));

  const projects = deriveProjects();
  return {
    today,
    timezone: TZ,
    now: FIXTURE_NOW,
    day: {
      priorities,
      scheduled,
      overdue: due.filter((t) => t.due_date! < today),
      dueToday: due.filter((t) => t.due_date === today),
      upcoming: due.filter((t) => t.due_date! > today),
      completedToday: completedThisWeek.filter((t) => dateOfInstant(t.completed_at!, TZ) === today),
      completedThisWeek: completedThisWeek.length,
    },
    inbox: fixtureInboxIdeas.length,
    areas,
    projects,
    projectFocus: aggregateProjectFocus(sessions, dayRange, weekRange),
    goals,
    habits: habitSummaries,
    focus,
    insights,
    milestones: milestonesDue,
    weekTheme: FIXTURE_WEEK_THEME,
  };
}
