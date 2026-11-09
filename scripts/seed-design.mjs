// Seeds a synthetic workspace into the LOCAL Supabase stack for design review and screenshots.
//
//   npm run db:start && node scripts/seed-design.mjs     (optional: SEED_TZ=Pacific/Kiritimati)
//
// It refuses to run unless `supabase status` reports a loopback API URL, so it can never write to a
// hosted project. It (re)creates one confirmed user, design@example.test / design-preview-only,
// whose workspace holds invented data only: areas, tags, goals and milestones, projects, ~25 open
// and ~29 done tasks (with subtasks, a dependency, a recurring task), habits with two months of
// logs, year/month/week/day plans with priorities, time blocks, focus sessions, ideas, notes,
// journal entries, vision-board cards (two with images from tests/e2e/fixtures), and a weekly
// review. Dates are relative to "today" in the profile's timezone, so the app always looks current.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EMAIL = "design@example.test";
const PASSWORD = "design-preview-only";
// Override with SEED_TZ to review the app at a different time of day (e.g. mid-afternoon).
const TZ = process.env.SEED_TZ ?? "Europe/Amsterdam";

// ------------------------------------------------------------------------------------ safety
let status;
try {
  const out = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  status = JSON.parse(out.slice(out.indexOf("{")));
} catch {
  console.error("Local Supabase is not running. Start it with `npm run db:start`.");
  process.exit(1);
}
const apiUrl = new URL(status.API_URL);
if (!["127.0.0.1", "localhost"].includes(apiUrl.hostname)) {
  console.error(`Refusing to seed ${apiUrl.origin}: only a local Supabase stack is allowed.`);
  process.exit(1);
}
const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
const admin = createClient(status.API_URL, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

// ------------------------------------------------------------------------------------ dates
const todayIn = (tz) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const TODAY = todayIn(TZ);
const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (date) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Mon
const WEEK_START = addDays(TODAY, 1 - weekday(TODAY));
/** A local wall-clock time in TZ as a UTC ISO instant. */
const at = (date, time) => {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName").value; // e.g. GMT+01:00
  const m = /GMT([+-])(\d\d):(\d\d)/.exec(parts);
  const offset = m ? (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(guess.getTime() - offset * 60_000).toISOString();
};
const d = (n) => addDays(TODAY, n);

// ------------------------------------------------------------------------------------ user
const existing = must(await admin.auth.admin.listUsers({ perPage: 1000 }), "list users");
const old = existing.users.find((u) => u.email === EMAIL);
if (old) {
  const ws = must(
    await admin.from("workspaces").select("id").eq("created_by", old.id),
    "old workspaces",
  );
  for (const w of ws) {
    const files = must(await admin.storage.from("vision-board").list(w.id, { limit: 100 }), "list");
    for (const folder of files) {
      const inner = must(
        await admin.storage.from("vision-board").list(`${w.id}/${folder.name}`),
        "list",
      );
      const paths = inner.map((f) => `${w.id}/${folder.name}/${f.name}`);
      if (paths.length) must(await admin.storage.from("vision-board").remove(paths), "remove");
    }
  }
  must(await admin.auth.admin.deleteUser(old.id), "delete old user");
}
const user = must(
  await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Sam Rivera" },
  }),
  "create user",
).user;
const workspace = must(
  await admin
    .from("workspaces")
    .select("id")
    .eq("created_by", user.id)
    .eq("is_personal", true)
    .single(),
  "workspace",
);
const W = workspace.id;
must(
  await admin
    .from("profiles")
    .update({ timezone: TZ, week_start: 1, display_name: "Sam Rivera" })
    .eq("id", user.id),
  "profile",
);
// The signed-in user, as the app sees it: subject to RLS and the triggers' own checks.
const asUser = createClient(status.API_URL, status.PUBLISHABLE_KEY ?? status.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
must(await asUser.auth.signInWithPassword({ email: EMAIL, password: PASSWORD }), "sign in");
const insertWith = async (client, table, rows) =>
  must(
    await client
      .from(table)
      .insert(rows.map((r) => ({ workspace_id: W, ...r })))
      .select(),
    table,
  );
const backdates = [];
const insert = async (table, rows) => {
  const clean = rows.map(({ _completedAt, ...r }) => r);
  const saved = await insertWith(admin, table, clean);
  rows.forEach((r, i) => r._completedAt && backdates.push([saved[i].id, r._completedAt]));
  return saved;
};
/** Tables whose triggers call private helpers granted only to signed-in users. */
const insertAsUser = (table, rows) => insertWith(asUser, table, rows);

// ------------------------------------------------------------------------------------ areas, tags
// Every new account starts with four default areas (signup trigger); rename them to this
// workspace's own areas rather than adding near-duplicates beside them.
const AREA_NAMES = { Finances: "Work", Mental: "Study", Physical: "Health", Spiritual: "Personal" };
for (const [from, to] of Object.entries(AREA_NAMES)) {
  must(
    await admin.from("areas").update({ name: to }).eq("workspace_id", W).eq("name", from),
    "rename area",
  );
}
const areaRows = must(await admin.from("areas").select().eq("workspace_id", W), "areas");
const area = (name) => areaRows.find((a) => a.name === name);
const [WORK, STUDY, HEALTH, PERSONAL] = ["Work", "Study", "Health", "Personal"].map(area);
const [DEEP, ERRAND, WRITING, CALL] = await insert("tags", [
  { name: "deep-work", color: "#6b7a8f" },
  { name: "errand", color: "#8a897c" },
  { name: "writing", color: "#9a8461" },
  { name: "call", color: "#5e7d63" },
]);

// ------------------------------------------------------------------------------------ goals, projects
const [G_THESIS, G_RUN, G_CUSTOMERS, G_SPANISH] = await insert("goals", [
  {
    title: "Submit the thesis by March",
    why: "Finish the degree and free up evenings.",
    status: "active",
    area_id: STUDY.id,
    start_date: "2026-09-01",
    target_date: "2027-03-15",
    sort_order: 0,
  },
  {
    title: "Run a half marathon",
    status: "active",
    area_id: HEALTH.id,
    start_date: "2026-09-01",
    target_date: "2027-04-12",
    target_value: 21.1,
    current_value: 14,
    unit: "km longest run",
    sort_order: 1,
  },
  {
    title: "Reach 40 paying customers",
    status: "active",
    area_id: WORK.id,
    start_date: "2026-07-01",
    target_date: "2027-06-30",
    target_value: 40,
    current_value: 27,
    unit: "customers",
    sort_order: 2,
  },
  {
    title: "Hold a conversation in Spanish",
    status: "paused",
    area_id: PERSONAL.id,
    target_date: "2027-08-01",
    sort_order: 3,
  },
]);
await insert("milestones", [
  {
    goal_id: G_THESIS.id,
    title: "Chapter 1 approved",
    due_date: "2026-09-30",
    completed_at: at("2026-09-29", "15:00"),
    sort_order: 0,
  },
  {
    goal_id: G_THESIS.id,
    title: "Chapter 2 approved",
    due_date: "2026-10-31",
    completed_at: at("2026-10-30", "11:00"),
    sort_order: 1,
  },
  { goal_id: G_THESIS.id, title: "Chapter 3 draft to supervisor", due_date: d(19), sort_order: 2 },
  { goal_id: G_THESIS.id, title: "Full draft", due_date: "2027-01-31", sort_order: 3 },
  { goal_id: G_THESIS.id, title: "Submission", due_date: "2027-03-15", sort_order: 4 },
  {
    goal_id: G_RUN.id,
    title: "Run 10 km without stopping",
    due_date: d(-22),
    completed_at: at(d(-23), "08:00"),
    sort_order: 0,
  },
  { goal_id: G_RUN.id, title: "Run 15 km without stopping", due_date: d(4), sort_order: 1 },
  { goal_id: G_RUN.id, title: "Race day", due_date: "2027-04-12", sort_order: 2 },
  { goal_id: G_CUSTOMERS.id, title: "Pricing page live", due_date: d(9), sort_order: 0 },
]);
const projects = await insert("projects", [
  {
    name: "Pricing page relaunch",
    status: "active",
    area_id: WORK.id,
    goal_id: G_CUSTOMERS.id,
    start_date: d(-20),
    due_date: d(9),
    description: "New tiers, clearer copy, and a cleaner checkout.",
    sort_order: 0,
  },
  {
    name: "Thesis chapter 3",
    status: "active",
    area_id: STUDY.id,
    goal_id: G_THESIS.id,
    start_date: d(-30),
    due_date: d(36),
    description: "Methods and first results.",
    sort_order: 1,
  },
  {
    name: "Half-marathon training",
    status: "active",
    area_id: HEALTH.id,
    goal_id: G_RUN.id,
    start_date: "2026-09-01",
    due_date: "2027-04-12",
    sort_order: 2,
  },
  {
    name: "Client site: Northfield Bakery",
    status: "active",
    area_id: WORK.id,
    start_date: d(-35),
    due_date: d(2),
    description: "Menu, ordering page, and a gallery.",
    sort_order: 3,
  },
  { name: "Home office setup", status: "active", area_id: PERSONAL.id, sort_order: 4 },
  { name: "Portfolio refresh", status: "on_hold", area_id: WORK.id, sort_order: 5 },
  {
    name: "Move to the new flat",
    status: "completed",
    area_id: PERSONAL.id,
    start_date: "2026-08-01",
    due_date: "2026-09-15",
    sort_order: 6,
  },
]);
const [PRICING, THESIS, RUNNING, CLIENT, OFFICE, PORTFOLIO, MOVE] = projects;

// ------------------------------------------------------------------------------------ tasks
let order = 0;
const T = (title, o = {}) => ({
  title,
  status: o.status ?? "todo",
  priority: o.priority ?? "medium",
  due_date: o.due ?? null,
  due_time: o.time ?? null,
  estimate_minutes: o.est ?? null,
  project_id: o.project?.id ?? null,
  area_id: (o.area ?? (o.project && areaOf(o.project)))?.id ?? null,
  description: o.description ?? null,
  sort_order: order++,
  // completed_at is set by a trigger (now()); the wanted time is applied afterwards (backdate).
  _completedAt: o.completedAt ?? null,
});
const areaOf = (p) => [WORK, STUDY, HEALTH, PERSONAL].find((a) => a.id === p.area_id);
const open = await insert("tasks", [
  T("Send revised quote to Northfield", { project: CLIENT, priority: "high", due: d(-2), est: 20 }),
  T("Book physio follow-up", { area: HEALTH, due: d(-4), est: 10 }),
  T("Finalize pricing tiers copy", {
    project: PRICING,
    priority: "urgent",
    status: "in_progress",
    due: d(0),
    est: 90,
    description:
      "Three tiers. Keep each under 40 words; lead with what changes for existing customers.",
  }),
  T("Review chapter 3 outline with supervisor notes", {
    project: THESIS,
    priority: "high",
    due: d(0),
    time: "16:00",
    est: 60,
  }),
  T("Pay studio rent", { area: PERSONAL, due: d(0), est: 10 }),
  T("Export hero illustrations", { project: PRICING, due: d(1), est: 30 }),
  T("Migrate menu page to the CMS", { project: CLIENT, priority: "high", due: d(2), est: 120 }),
  T("Long run, 14 km", { project: RUNNING, due: d(4), est: 85 }),
  T("Draft section 3.2 on methods", { project: THESIS, due: d(5), est: 120 }),
  T("QA checkout on mobile", { project: PRICING, due: d(6), est: 45 }),
  T("Order a monitor arm", { project: OFFICE, priority: "low", due: d(7) }),
  T("Write FAQ entries", { project: PRICING, due: d(13), est: 60 }),
  T("Set up the A/B test", { project: PRICING, priority: "low" }),
  T("Collect sources for section 3.3", { project: THESIS }),
  T("Rewrite the introduction paragraph", { project: THESIS }),
  T("Format the bibliography", { project: THESIS, priority: "low", due: d(20) }),
  T("Buy new running shoes", { project: RUNNING, priority: "low" }),
  T("Plan interval sessions for December", { project: RUNNING }),
  T("Write handover notes", { project: CLIENT, due: d(16) }),
  T("Compress gallery images", { project: CLIENT, priority: "low" }),
  T("Cable management under the desk", { project: OFFICE, priority: "low" }),
  T("Choose a desk lamp", { project: OFFICE, priority: "low" }),
  T("Renew passport", { area: PERSONAL, due: d(29) }),
  T("Call grandma", { area: PERSONAL }),
  T("Back up the laptop", { area: PERSONAL, priority: "low" }),
]);
const byTitle = (title) => open.find((t) => t.title === title);
// Done tasks spread over the last weeks, mixing projects.
const doneSpec = [
  [-28, 3],
  [-14, 3],
  [-6, 3],
  [-5, 4],
  [-4, 1],
  [-3, 2],
  [-2, 5],
  [-1, 6],
  [0, 2],
];
const owners = [PRICING, THESIS, RUNNING, CLIENT, OFFICE];
const counts = [8, 4, 6, 9, 2];
const queue = [];
for (let round = 0; queue.length < 29; round++)
  counts.forEach((c, i) => round < c && queue.push(owners[i]));
const doneTitles = {
  [PRICING.id]: [
    "Audit current pricing page",
    "Interview three customers",
    "Draft tier names",
    "Sketch layout",
    "Write tier comparison",
    "Review copy with Ana",
    "Pick hero photo",
    "Set up staging page",
  ],
  [THESIS.id]: [
    "Outline chapter 3",
    "Read Martín & Cho 2024",
    "Clean survey data",
    "Meet supervisor",
  ],
  [RUNNING.id]: [
    "Easy run 6 km",
    "Intervals 6×400 m",
    "Long run 12 km",
    "Easy run 7 km",
    "Tempo run 5 km",
    "Long run 13 km",
  ],
  [CLIENT.id]: [
    "Kick-off call",
    "Collect menu photos",
    "Wireframe home page",
    "Choose fonts",
    "Build menu template",
    "Set up hosting",
    "Write about page",
    "Client feedback round",
    "Fix mobile nav",
  ],
  [OFFICE.id]: ["Measure the desk space", "Order a chair"],
};
const seen = {};
let slot = 0;
const doneRows = [];
for (const [day, count] of doneSpec) {
  for (let i = 0; i < count; i++) {
    const p = queue[slot++];
    seen[p.id] = (seen[p.id] ?? 0) + 1;
    const time =
      day === 0
        ? `0${8 + i}:${String(10 + i * 7).padStart(2, "0")}`
        : `${10 + i}:${String(i * 9).padStart(2, "0")}`;
    doneRows.push(
      T(doneTitles[p.id][seen[p.id] - 1], {
        project: p,
        status: "done",
        completedAt: at(d(day), time),
      }),
    );
  }
}
await insert("tasks", doneRows);
await insert("tasks", [
  T("Unpack the last boxes", {
    project: MOVE,
    status: "done",
    completedAt: at("2026-09-14", "17:00"),
  }),
  T("Pick a new portfolio layout", { project: PORTFOLIO }),
]);
// Subtasks, a dependency, a recurring task, tags.
const tiers = byTitle("Finalize pricing tiers copy");
await insert("tasks", [
  {
    ...T("Starter tier", { project: PRICING, status: "done", completedAt: at(d(-1), "17:20") }),
    parent_task_id: tiers.id,
  },
  { ...T("Team tier", { project: PRICING }), parent_task_id: tiers.id },
  { ...T("Studio tier", { project: PRICING }), parent_task_id: tiers.id },
]);
await insert("task_dependencies", [
  {
    task_id: byTitle("QA checkout on mobile").id,
    depends_on_task_id: byTitle("Export hero illustrations").id,
  },
]);
await insert("tasks", [
  {
    ...T("Plan the week", {
      area: PERSONAL,
      due: d(8 - weekday(TODAY)) /* next Monday */,
      est: 30,
    }),
    recurrence_frequency: "weekly",
    recurrence_interval: 1,
    recurrence_weekdays: [1],
    recurrence_anchor: WEEK_START,
  },
]);
await insert("task_tags", [
  { task_id: tiers.id, tag_id: WRITING.id },
  { task_id: tiers.id, tag_id: DEEP.id },
  { task_id: byTitle("Draft section 3.2 on methods").id, tag_id: DEEP.id },
  { task_id: byTitle("Draft section 3.2 on methods").id, tag_id: WRITING.id },
  { task_id: byTitle("Pay studio rent").id, tag_id: ERRAND.id },
  { task_id: byTitle("Call grandma").id, tag_id: CALL.id },
  { task_id: byTitle("Renew passport").id, tag_id: ERRAND.id },
]);

// ------------------------------------------------------------------------------------ habits
const habits = await insert("habits", [
  {
    title: "Morning pages",
    kind: "boolean",
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    starts_on: d(-75),
    area_id: PERSONAL.id,
    sort_order: 0,
  },
  {
    title: "Read",
    kind: "measurable",
    target_value: 20,
    unit: "pages",
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    starts_on: d(-75),
    area_id: STUDY.id,
    sort_order: 1,
  },
  {
    title: "Meditate",
    kind: "boolean",
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5],
    starts_on: d(-75),
    area_id: HEALTH.id,
    sort_order: 2,
  },
  {
    title: "Run",
    kind: "boolean",
    frequency: "weekly",
    times_per_week: 3,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    starts_on: d(-75),
    area_id: HEALTH.id,
    sort_order: 3,
  },
  {
    title: "No screens after 22:00",
    kind: "boolean",
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    starts_on: d(-75),
    area_id: PERSONAL.id,
    sort_order: 4,
  },
  {
    title: "Floss",
    kind: "boolean",
    frequency: "daily",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    starts_on: d(-200),
    archived_at: at(d(-40), "09:00"),
    sort_order: 5,
  },
]);
const [H_PAGES, H_READ, H_MED, H_RUN, H_SCREENS] = habits;
const logs = [];
for (let i = -60; i <= 0; i++) {
  const day = d(i);
  const wd = weekday(day);
  logs.push({ habit_id: H_PAGES.id, log_date: day, value: 1, rest: false });
  if (i < 0 && i !== -9 && i !== -31)
    logs.push({
      habit_id: H_READ.id,
      log_date: day,
      value: 18 + ((((i * 7) % 9) + 9) % 9),
      rest: false,
    });
  if (i === 0) logs.push({ habit_id: H_READ.id, log_date: day, value: 12, rest: false });
  if (i < 0 && wd <= 5 && i !== -1 && i !== -6 && i !== -24)
    logs.push({ habit_id: H_MED.id, log_date: day, value: 1, rest: false });
  if ([1, 3, 6].includes(wd) && i <= 0)
    logs.push({ habit_id: H_RUN.id, log_date: day, value: 1, rest: false });
  if (i < 0 && i !== -11 && i !== -26)
    logs.push({ habit_id: H_SCREENS.id, log_date: day, value: 1, rest: false });
  if (i === -11) logs.push({ habit_id: H_SCREENS.id, log_date: day, value: null, rest: true });
}
await insert("habit_logs", logs);

// ------------------------------------------------------------------------------------ plans
const monthStart = `${TODAY.slice(0, 7)}-01`;
const [year] = await insertAsUser("plans", [
  {
    period: "year",
    period_start: `${TODAY.slice(0, 4)}-01-01`,
    theme: "Finish what I start.",
    focus: "Thesis, the business, and a half marathon.",
  },
]);
const [month] = await insertAsUser("plans", [
  {
    period: "month",
    period_start: monthStart,
    parent_plan_id: year.id,
    theme: "Launch month",
    focus: "Ship pricing, hand over Northfield, keep training.",
  },
]);
const [week] = await insertAsUser("plans", [
  {
    period: "week",
    period_start: WEEK_START,
    parent_plan_id: month.id,
    theme: "Ship the pricing page; keep mornings for the thesis.",
  },
]);
const [day] = await insertAsUser("plans", [
  {
    period: "day",
    period_start: TODAY,
    parent_plan_id: week.id,
    theme: "One deep block before lunch.",
  },
]);
await insertAsUser("plan_items", [
  { plan_id: year.id, goal_id: G_THESIS.id, sort_order: 0 },
  { plan_id: year.id, goal_id: G_CUSTOMERS.id, sort_order: 1 },
  { plan_id: month.id, project_id: PRICING.id, sort_order: 0 },
  { plan_id: month.id, project_id: CLIENT.id, sort_order: 1 },
  { plan_id: week.id, project_id: PRICING.id, sort_order: 0 },
  { plan_id: week.id, task_id: byTitle("Draft section 3.2 on methods").id, sort_order: 1 },
  { plan_id: day.id, task_id: tiers.id, sort_order: 0 },
  { plan_id: day.id, task_id: byTitle("Send revised quote to Northfield").id, sort_order: 1 },
  {
    plan_id: day.id,
    task_id: byTitle("Review chapter 3 outline with supervisor notes").id,
    sort_order: 2,
  },
]);

// ------------------------------------------------------------------------------------ time blocks
const block = (date, start, end, title, o = {}) => ({
  title,
  starts_at: at(date, start),
  ends_at: at(date, end),
  timezone: TZ,
  project_id: o.project?.id ?? null,
  task_id: o.task?.id ?? null,
  notes: o.notes ?? null,
  origin: "app",
});
await insert("time_blocks", [
  block(d(0), "08:30", "10:00", "Thesis writing", { project: THESIS }),
  block(d(0), "11:00", "12:30", "Pricing page copy", { project: PRICING, task: tiers }),
  block(d(0), "15:00", "16:00", "Northfield review call", {
    project: CLIENT,
    task: byTitle("Send revised quote to Northfield"),
  }),
  block(d(1), "09:00", "11:00", "Hero illustrations", {
    project: PRICING,
    task: byTitle("Export hero illustrations"),
  }),
  block(d(1), "14:00", "15:00", "Gym", { project: RUNNING }),
  block(d(2), "09:00", "12:00", "CMS migration", {
    project: CLIENT,
    task: byTitle("Migrate menu page to the CMS"),
  }),
  block(d(-1), "09:00", "11:00", "Pricing tiers", { project: PRICING }),
  block(d(-1), "16:00", "17:00", "Thesis reading", { project: THESIS }),
]);

// ------------------------------------------------------------------------------------ focus sessions
const sessions = [];
const sess = (date, start, minutes, project, type = "focus", task = null) =>
  sessions.push({
    session_type: type,
    started_at: at(date, start),
    ended_at: new Date(Date.parse(at(date, start)) + minutes * 60_000).toISOString(),
    duration_seconds: minutes * 60,
    project_id: project?.id ?? null,
    task_id: task?.id ?? null,
  });
for (let i = -13; i <= 0; i++) {
  const date = d(i);
  const wd = weekday(date);
  if (wd >= 6 && i !== -8) continue;
  if (i === 0) {
    sess(
      date,
      "08:30",
      50,
      THESIS,
      "focus",
      byTitle("Review chapter 3 outline with supervisor notes"),
    );
    sess(date, "09:20", 10, null, "short_break");
    sess(date, "09:30", 25, PRICING, "focus", tiers);
    continue;
  }
  sess(date, "08:30", 50, i % 2 ? THESIS : PRICING);
  sess(date, "09:20", 10, null, "short_break");
  sess(date, "09:30", i % 3 ? 50 : 25, i % 3 ? PRICING : CLIENT);
  if (i % 2 === 0) sess(date, "14:00", 25, CLIENT);
}
await insert("focus_sessions", sessions);

// ------------------------------------------------------------------------------------ ideas
const ideas = await insert("ideas", [
  {
    title: "Newsletter about the pricing change",
    body: "Explain what changes for current customers before they see it.",
    status: "inbox",
  },
  { title: "Try time-boxed email twice a day", status: "inbox" },
  {
    title: "Workshop idea: planning for freelancers",
    body: "Two hours, small group. Year → week → day.",
    status: "developing",
  },
  { title: "Gift for Sam's birthday", status: "inbox" },
  { title: "Read up on spaced repetition for thesis notes", status: "inbox" },
  { title: "Standing desk or not?", status: "inbox" },
  { title: "Weekend trip in December", status: "someday" },
  {
    title: "Template for client handovers",
    body: "Hosting, logins, how to edit the menu, who to call.",
    status: "inbox",
  },
  { title: "Podcast episode on deep work", status: "inbox" },
  { title: "Ask the bakery for a testimonial", status: "inbox" },
  { title: "Learn basic bread baking", status: "someday" },
  { title: "Old idea: weekly vlog", status: "archived" },
]);
await insert("idea_tags", [
  { idea_id: ideas[0].id, tag_id: WRITING.id },
  { idea_id: ideas[2].id, tag_id: WRITING.id },
  { idea_id: ideas[7].id, tag_id: DEEP.id },
]);

// ------------------------------------------------------------------------------------ notes
await insert("notes", [
  {
    title: "Pricing tiers: decisions",
    project_id: PRICING.id,
    body: "Starter stays at the current price for existing customers until March.\n\nTeam adds shared projects and the weekly review export.\n\nStudio is for agencies: client workspaces, priority support.\n\nOpen question: annual discount, 15% or two months free?",
  },
  {
    title: "Supervisor meeting, 3 Nov",
    project_id: THESIS.id,
    goal_id: G_THESIS.id,
    body: "- Narrow the methods section to the survey and the two interviews.\n- Move the literature table to an appendix.\n- Next check-in after section 3.2.",
  },
  {
    title: "Northfield: logins and contacts",
    project_id: CLIENT.id,
    body: "Hosting: shared account in the password manager.\nMenu edits: Lena, mornings only.\nPhotos: the folder from 21 Oct.",
  },
  {
    title: "Training paces",
    project_id: RUNNING.id,
    body: "Easy: 6:15–6:40 /km\nTempo: 5:20 /km\nIntervals: 4:55 /km",
  },
  { title: "Books to read next", body: "The Writing Life\nDeep Work (re-read)\nThe Practice" },
  {
    title: "Old desk measurements",
    archived_at: at(d(-30), "10:00"),
    body: "140 × 70 cm, 74 cm high.",
  },
]);

// ------------------------------------------------------------------------------------ journal
const prompts = [
  "What should change tomorrow?",
  "What gave you energy today?",
  "What are you avoiding, and why?",
];
await insert("journal_entries", [
  {
    entry_date: d(-1),
    title: "A good, long day",
    mood: 4,
    energy: 3,
    prompt: prompts[1],
    body: "Pricing copy finally clicked once I wrote it for existing customers first. The run in the evening helped more than I expected.",
  },
  {
    entry_date: d(-2),
    mood: 3,
    energy: 2,
    body: "Slow start. Too many small things before the first block; tomorrow the thesis goes first.",
  },
  {
    entry_date: d(-4),
    title: "Rest day",
    mood: 4,
    energy: 4,
    prompt: prompts[0],
    body: "No laptop after lunch. Called grandma, cooked, read 40 pages.",
  },
  {
    entry_date: d(-6),
    mood: 2,
    energy: 2,
    prompt: prompts[2],
    body: "Avoiding the Northfield quote because the number feels awkward. Writing it down helps: it is a fair price for the work.",
  },
  { entry_date: d(-8), mood: 4, energy: 4, body: "Long run 13 km, felt easy until 11." },
  {
    entry_date: d(-11),
    mood: 3,
    energy: 3,
    body: "Supervisor meeting went fine. Clear next steps.",
  },
]);

// ------------------------------------------------------------------------------------ vision board
const vision = await insert("vision_board_items", [
  {
    title: "Mornings for deep work",
    body: "Two quiet hours before anything else.",
    area_id: PERSONAL.id,
    sort_order: 0,
  },
  {
    title: "Finish line in April",
    body: "21.1 km, smiling.",
    goal_id: G_RUN.id,
    area_id: HEALTH.id,
    sort_order: 1,
  },
  { title: "A thesis I'm proud of", goal_id: G_THESIS.id, area_id: STUDY.id, sort_order: 2 },
  {
    title: "Forty customers who stay",
    body: "Fewer, happier customers over fast growth.",
    goal_id: G_CUSTOMERS.id,
    area_id: WORK.id,
    sort_order: 3,
  },
  { body: "Weekends without a laptop.", area_id: PERSONAL.id, sort_order: 4 },
  { title: "A desk that feels calm", area_id: PERSONAL.id, sort_order: 5 },
]);
for (const [item, file, alt] of [
  [vision[0], "dawn.png", "Soft light at dawn"],
  [vision[1], "sea.png", "Open sea under a clear sky"],
]) {
  const path = `${W}/${item.id}/${file}`;
  must(
    await admin.storage
      .from("vision-board")
      .upload(path, readFileSync(`tests/e2e/fixtures/${file}`), { contentType: "image/png" }),
    `upload ${file}`,
  );
  must(
    await admin
      .from("vision_board_items")
      .update({ image_path: path, image_alt: alt })
      .eq("id", item.id),
    "image path",
  );
}

// ------------------------------------------------------------------------------------ weekly review
await insert("weekly_reviews", [
  {
    week_start: addDays(WEEK_START, -7),
    went_well: "Four focus mornings in a row. Northfield gallery done early.",
    could_improve: "Started the quote too late; it slipped into this week.",
    lessons: "Price conversations get easier when written first.",
    next_focus: "Pricing page and section 3.2.",
  },
]);

// ------------------------------------------------------------------------------------ backdate
// The tasks trigger always stamps completed_at with now() and ignores supplied values (by design).
// To give the seed a realistic history, set the times directly in the LOCAL database container,
// with triggers off for this statement only.
const container = `supabase_db_${readFileSync("supabase/config.toml", "utf8").match(/^project_id = "(.+)"/m)[1]}`;
const values = backdates.map(([id, at]) => `('${id}'::uuid, '${at}'::timestamptz)`).join(",\n");
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
  ],
  {
    input: `begin;\nset local session_replication_role = replica;\nupdate public.tasks t set completed_at = v.at from (values ${values}) as v(id, at) where t.id = v.id;\ncommit;\n`,
    stdio: ["pipe", "inherit", "inherit"],
  },
);

console.log(`Seeded ${EMAIL} (password: ${PASSWORD}) in ${apiUrl.origin}, today ${TODAY} ${TZ}.`);
