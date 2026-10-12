# Personal Productivity OS

A planning and self-management app for tasks, connected yearly-to-daily plans, projects, habits, goals, a vision board, brainstorming, notes, journaling, time blocking, focus sessions, and weekly reviews.

This repository is being implemented phase-by-phase from `IMPLEMENTATION_PLAN.md`. Phases 0–4 are done: you can capture ideas, manage tasks and projects, plan years, months, weeks, and days in one Planner, schedule work on an interactive calendar, optionally connect Google Calendar, track habits, set goals with milestones and a vision board, keep text notes, and write dated journal entries. Focus sessions, reminders, weekly reviews, and backups come in later phases.

## Current status

| Phase                                   | Status                                                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundation                          | Done: Next.js 16 App Router, TypeScript strict, Tailwind v4, ESLint, Prettier, Vitest, GitHub Actions CI, app shell, light/dark/system theme, `/api/health`                                                    |
| 1 — Supabase auth & workspace isolation | Done: email/password auth with verification and reset, protected routes, personal workspace + default areas, RLS with integration tests                                                                        |
| 2 — Core execution                      | Done: inbox, tasks (subtasks, dependencies, recurrence, tags), projects, editable life areas, connected plans, Today, dashboard, quick capture                                                                 |
| 3 — Planning & calendar                 | Done: redesigned Planner (Day/Week/Month/Year), manual time blocks with drag-and-drop scheduling, rescheduling, carry-forward, optional Google Calendar (read-only events, one-way block sync)                 |
| 4 — Habits, goals, vision, notes        | Done: habits (daily/weekly, measurable, rest days, streaks, history), goals with milestones linked to projects, tasks, and plans, vision board (private images), text notes, and a dated journal with autosave |
| 5+                                      | Not started                                                                                                                                                                                                    |

What exists today:

- **Accounts:** sign up (with email verification), sign in, sign out, forgot/reset password. Unverified accounts cannot sign in. Every route except the auth pages, `/auth/*`, and `/api/health` requires a session (`proxy.ts` plus a server-side re-check on each page).
- **Quick capture:** the button at the top of the sidebar, or press <kbd>q</kbd> anywhere outside a text field, saves an idea (to the Inbox) or a task. The dialog closes only after the server has saved it.
- **Inbox:** capture with just a title; optional details. Search, filter by status (Inbox / Developing / Someday / Archived) and tag, edit, archive, delete. Convert an idea into a task or a project in one database transaction: content and tags are copied, the idea is kept (archived) with a link to what it became, and converting twice does not create duplicates.
- **Tasks:** title, notes, status (to do / in progress / done / cancelled), priority, due date and optional time, estimate, project, life area, tags. Complete/reopen from any list. List view with search, filters (status, priority, due, project, area, tag), sort, and grouping; Kanban board with a status column per state (move cards with the keyboard-accessible status picker). Filters live in the URL.
  - **Subtasks:** one level deep. Deleting a task deletes its subtasks; the confirmation says how many.
  - **Dependencies:** "waiting on" other tasks. A task cannot be completed until what it depends on is done or cancelled; cycles are rejected. Enforced in the database.
  - **Recurrence:** daily, weekly (optionally on chosen weekdays), or monthly, every N days/weeks/months, with an optional end date. Completing an occurrence creates the next one (copying tags, project, priority). Monthly dates on the 29th–31st clamp to shorter months without drifting. Completing, reopening, and completing again never creates a second next occurrence.
  - Overdue is shown only for unfinished tasks, using today's date in your timezone.
- **Projects:** create, edit (outcome, notes, dates, status, area), archive, delete (tasks are kept). Progress is derived from the project's tasks (cancelled tasks excluded), never stored.
- **Life areas** (Settings): rename, recolor, reorder, archive/restore, delete, and add custom areas.
- **Planner** (`/planner`): one workspace with Day, Week, Month, and Year views. Switch views with the tabs or <kbd>d</kbd> / <kbd>w</kbd> / <kbd>m</kbd> / <kbd>y</kbd>, move with ← / → or the arrows, and jump back with **Today** (<kbd>t</kbd>). Each view has one job: the Year sets a direction and major outcomes (projects) and shows the twelve months; a Month has a theme and outcomes; a Week has a focus and a short list of priorities (a gentle hint above 5); a Day has an intention and 1–3 priorities next to the timeline. Everything is edited inline and saves on its own with an honest "Saving… / Saved" state. You can start at any level: a plan row is created only when you first write to it, and parent plans are never required (chips show the enclosing periods and their themes). Add a new priority by typing, or **Link existing** tasks and projects with search. Progress comes from the linked work. Notes and the period review sit under "Notes & review".
- **Calendar and time blocks** (Day/Week/Month views): a 24-hour timeline (day/week), a month grid, and an agenda list; phones default to the agenda. Drag a task from **Unscheduled** onto a time slot to schedule it (length from its estimate, 30 minutes by default), click or drag across empty time to create a block, drag blocks to move them and their bottom edge to resize, or open a block to edit it in a side panel (title, linked task, date, start, end, notes). A block is scheduled time, not a deadline: scheduling never changes a task's due date, and deadlines show separately in the "Due" row. Overlapping blocks are allowed but highlighted, with a warning when you save. All times use your profile timezone (Settings), with a notice when your device is in a different one; blocks crossing midnight and DST changes are handled. Works without any Google credentials.
- **Google Calendar (optional, off unless configured):** connect in Settings. Events from the calendars you choose appear in the Planner, read-only and hatched; busy events count in overlap warnings. Your time blocks are sent one way to one calendar you own (title and time only), updated when you change them and removed when you delete them. The Planner shows "Syncing… / Synced with Google / Google sync failed · Retry", and each block's panel says whether it is in Google. Revoked or expired access shows "Reconnect Google Calendar" and never blocks manual scheduling. Settings has calendar choice, "Sync now", and Disconnect (deletes stored tokens and revokes access).
- **Rescheduling:** the day or week that contains today lists **Needs rescheduling** — open tasks whose block has passed, or whose deadline has passed — with explicit actions: schedule a new block, move the deadline (today / tomorrow / next week / a date), or add to today's priorities. **Carry forward** links a period's unfinished priorities to the next period (originals stay, deadlines unchanged, running it twice does nothing new).
- **Habits** (`/habits`): add a habit by typing its name. In its settings, choose "done / not done" or an amount with a daily target and unit (e.g. 8 glasses), and either certain weekdays or "N times a week". Check it off from the habit list, Today, the Planner's Day view, or the dashboard; mark a **rest day** (the moon) when you're deliberately skipping. Streaks count scheduled days (or weeks, for weekly habits) in your timezone; rest days and unscheduled days never break a streak, and today doesn't count as missed until it's over. Each habit page shows this week, this month, and the last 30 days, plus a 12-week history where any past day can be corrected. Archive or delete from the habit page.
- **Goals** (`/goals`): a title is enough; add why it matters, a description, status (active / paused / achieved / archived), start and target dates, and an optional measurable target (e.g. 1,000 km, with the current value updated inline). Break a goal into **milestones** (inline add, rename, due date, done, reorder). Link projects and tasks to a goal from the goal page or from a project/task's "Goal" field; progress shows milestones, the measure, and the linked work separately, never stored. Goals and milestones can be Year/Month priorities in the Planner (Link existing, or type a new goal), and the Month and Year views list milestones due. Convert an idea to a goal from the Inbox.
- **Vision board** (`/goals/vision`): type a word or quote, or pick an image, and it becomes a card. Filter by life area or goal, reorder by drag-and-drop or the arrow buttons, and edit a card in a side panel (text, image, image description, goal, area, archive, delete). A goal's page shows its cards. Images are JPEG/PNG/WebP/GIF up to 5 MB, stored in a private bucket and shown through short-lived signed links.
- **Notes** (`/notes`): text you want to keep that isn't a task or a dated entry. Add one with just a title, then edit the body, link it to a project, goal, and/or task, and add tags. Search title and body, filter by tag, archive/restore, and delete. The list shows active notes (most recently edited first) with an Archived tab; a note's page links to whatever it's attached to. Deleting the linked project, goal, or task keeps the note (the link is cleared).
- **Journal** (`/journal`): dated reflections. Start a blank entry, or seed it from a single prompt or the full daily reflection template (What mattered today? / What went well? / What did I learn? / What should change tomorrow? / What am I grateful for?). The editor autosaves as you write with an honest state ("Saving…", "Saved" only after the server confirms, "Unsaved changes…", "Offline — not saved yet", or an error), flushes when you leave the field or hide the tab, and retries when you come back online. Record an optional title, mood and energy (1–5), and tags. Several entries can share one date. Browse grouped by month, filter by month or tag, and search title and body. Journal text is private to your workspace and is never sent to Google, analytics, or any AI/third-party service.
- **Profile** (Settings): edit your name, timezone, and week start.
- **Today:** today's priorities (the day plan's linked work), today's habits, today's scheduled blocks, overdue, due today, and completed today. Task pages list their scheduled time.
- **Dashboard:** counts for overdue, due today, inbox, and active projects; today's priorities; today's habits; this week's theme and completed tasks; needs attention; upcoming 7 days; active project progress.
- Loading skeletons, empty states, error boundaries with retry, confirmation dialogs for deletes, and "Saving… / Saved" shown only after the server confirms.

### Security model

Schemas: `supabase/migrations/20261011230000_identity_and_workspaces.sql` (Phase 1), `supabase/migrations/20261012090000_core_execution.sql` (Phase 2), `supabase/migrations/20261012120000_time_blocks.sql`, and `supabase/migrations/20261013090000_google_calendar.sql` (Phase 3), and `supabase/migrations/20261014090000_habits_goals_vision.sql` and `supabase/migrations/20261015090000_notes_and_journal.sql` (Phase 4).

| Table                                                                                                               | Read                                                               | Write from the browser/API                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                                                                                                          | own row                                                            | update own `display_name`, `timezone`, `week_start`                                                                                                                               |
| `workspaces`                                                                                                        | workspaces you are a member of                                     | owner/admin may rename                                                                                                                                                            |
| `workspace_members`                                                                                                 | members of your workspaces                                         | none (bootstrap trigger only)                                                                                                                                                     |
| `areas`, `tags`, `projects`, `tasks`, `task_tags`, `task_dependencies`, `ideas`, `idea_tags`, `plans`, `plan_items` | your workspaces                                                    | owner/admin/member insert/update/delete; viewers read-only                                                                                                                        |
| `time_blocks`                                                                                                       | your workspaces                                                    | owner/admin/member insert/update/delete of app-created blocks only; blocks with `origin = 'google'` are read-only, and `origin` / external event IDs cannot be written by clients |
| `google_calendar_connections`, `time_block_sync`                                                                    | only the user who connected, while they can write in the workspace | the same user only; `workspace_id`/`user_id` can never change; tokens are stored as ciphertext only                                                                               |
| `habits`, `habit_logs`, `goals`, `milestones`, `vision_board_items`                                                 | your workspaces                                                    | owner/admin/member insert/update/delete; viewers read-only; a log, milestone, link, or card can only point at rows in the same workspace                                          |
| `notes`, `note_tags`, `journal_entries`, `journal_entry_tags`                                                       | your workspaces                                                    | owner/admin/member insert/update/delete; viewers read-only; a note links only to a project/goal/task in the same workspace, and tag links stay within the workspace               |
| Storage bucket `vision-board` (private)                                                                             | files under `{workspace_id}/…` of your workspaces                  | writers may upload only to `{workspace_id}/{card_id}/…` for a card that exists in that workspace; writers may delete; no public URLs                                              |

- RLS is enabled on every table, in the same migration that creates it.
- Every reference between rows is a composite foreign key on `(id, workspace_id)`, so a row can only point at rows in its own workspace, even with a guessed UUID.
- Server actions also scope every ID-based update and delete (and the idea-conversion and tag functions) to the active workspace resolved on the server, so a member of several workspaces cannot change another workspace's rows by passing their IDs from this one. Those writes live in `features/*/mutations.ts` and are covered by `tests/integration/active-workspace-scope.test.ts`.
- Table and column privileges are granted explicitly: `workspace_id` can never be changed, and trigger-managed columns (`completed_at`, recurrence series fields) cannot be written by clients.
- Database functions called from the app (`convert_idea_to_task/project/goal`, `set_task_tags`, `set_idea_tags`, `set_note_tags`, `set_journal_tags`, `add_task_to_plan`, `add_project_to_plan`, `add_goal_to_plan`) run with the caller's permissions, so RLS applies. Membership checks are `security definer` helpers in a non-exposed `private` schema.
- `anon` (signed-out) has no privileges on any of these tables.
- The app uses only the publishable key. No service-role/secret key is used by the app; integration tests use the local stack's secret key only to create test users.
- Task, idea, project, habit, goal, vision-board, note, and journal content is never logged or sent to third parties. Journal and note text stays in Supabase and is never sent to Google, analytics, or any AI service. Vision images go only to your Supabase Storage bucket, uploaded from the browser with your own session (so Storage RLS applies), then attached to the card by a server action that checks the path and that the file exists.

Known limitations / notes:

- **Google Calendar** is one-way: editing or deleting a Yawm event in Google doesn't change Yawm, and the next change to that block in Yawm overwrites (or restores) the Google copy. Google events are shown, never edited or stored. Only calendars you own can be shown or written to (the narrowest scopes allow nothing else), at most 10 shown calendars, and recurring Google events are expanded by Google. One connection per workspace: the member who connected it is the only one whose changes sync immediately; other members' changes sync the next time the owner syncs. Sync covers blocks that ended at most 7 days ago (plus anything synced before), 25 Google writes per run; the Planner keeps going until everything is sent. Disconnecting leaves events already sent in Google Calendar. There is no background job: sync runs after each change, when the Planner opens with pending work, and from "Sync now".
- Time blocks don't repeat, are limited to 24 hours, and aren't shared between workspaces. Rescheduling is always an explicit action; nothing moves on its own.
- Dragging on the calendar needs a mouse or touch. Keyboard users can do the same through the **Schedule** buttons and the block side panel.
- The Unscheduled tray lists open tasks with no upcoming block (this period's priorities first; a short list with "Show all"). Scheduling data considers at most the 500 open tasks with the nearest deadlines.
- The Planner's month grid shows blocks and deadlines but not plan priorities of individual days.
- **Habits:** no reminders yet (planned for Phase 5's notifications). Streaks and rates look back at most about three years of logs. A habit's schedule applies to its whole history: changing a habit's days re-evaluates past days too. Future days can't be logged.
- **Goals:** a project or task belongs to at most one goal; progress of linked work counts tasks directly on the goal plus tasks of its linked projects.
- **Vision board:** at most 500 cards are shown per view, and image links are valid for an hour (reload the page after that). If the browser closes between the upload and the attach step, the uploaded file stays in Storage without a card; it is removed when the card is deleted, but a file without any card is not cleaned up automatically. Images are not resized or cropped.
- **Notes:** at most the 1,000 most recently updated matching notes are listed (filters run in the database first), and search covers title and body. There is no rich-text, markdown rendering, or file attachments; a note links to at most one project, one goal, and one task.
- **Journal:** entries autosave on a short debounce and when the field loses focus or the tab is hidden; "Offline — not saved yet" means the change is held in the open tab only (there is no background queue yet — that arrives with the Phase 6 offline work), so keep the tab open until it shows "Saved". Mood and energy are simple 1–5 scales. Search covers title and body; the month list looks back over the most recent ~3,000 entries. No file attachments.
- **Global search** across all entities is not built yet; Tasks, Inbox, Notes, and Journal each have their own search (title and body).
- **Recurrence:** the next occurrence is created on completion (not pre-generated), so future occurrences don't appear until then. Subtasks and dependencies are not copied to the next occurrence. Rules are daily/weekly/monthly; no yearly or "last weekday of the month" rules.
- Saving a task's details and its tags are two server calls; if the tag update fails, the form says so and the details are already saved.
- No drag-and-drop on the board yet (status picker instead); no manual ordering of tasks.
- Tags are created from the task/idea forms; there is no screen to rename or delete tags yet.
- The Tasks list shows at most the 1,000 most recently created matching tasks (all filters, including tags, run in the database first); the page then says how many matched in total. The Inbox is paginated, 50 ideas per page.
- Workspace creation, switching, and membership management (invites) are not exposed yet; the schema supports multiple workspaces and roles for the collaboration phase.
- Account and workspace deletion flows are not built (required before public release).
- `NEXT_PUBLIC_*` values are inlined at build time; rebuild/restart after changing `.env.local`.
- `npm audit` reports high-severity advisories in `braces`/`micromatch`/`fast-glob` pulled in by `eslint-config-next` (lint-time dev dependency only, not shipped to the browser). The only automated "fix" downgrades to Next 14 lint config, so it is left until upstream updates.
- Dependencies for later phases (e.g. Dexie) are declared in `package.json` but unused until their phase.

## Start here

1. Read `REQUIREMENTS.md` for product behavior and acceptance criteria.
2. Read `CLAUDE.md` for implementation constraints and workflow.
3. Use `PROJECT_STRUCTURE.md` as a target structure; create folders as needed, not all at once.
4. Follow `IMPLEMENTATION_PLAN.md` in order.
5. Configure Supabase before building authenticated features.

## Recommended architecture

- Next.js App Router + React + TypeScript
- Vercel Hobby for personal/non-commercial hosting within plan limits
- Supabase PostgreSQL, Auth, Row Level Security, and private Storage
- Dexie/IndexedDB for browser-local snapshots/drafts, not as the canonical database
- Optional Google Calendar API integration

The primary database is managed by Supabase rather than being exclusively local. That supports your stated requirement for the same account data across laptop and phone and creates a foundation for future collaboration. Browser-local automatic snapshots are best-effort and can be lost if site storage is cleared, so retain user-triggered downloadable backups as well.

## Prerequisites

- Node.js 22.12 or newer (see `.nvmrc`; the test toolchain does not support Node 20)
- npm
- Git
- A Supabase account/project
- A Vercel account for deployment
- Google Cloud OAuth credentials only if Google Calendar sync is enabled

## Local setup

Requires Docker for the local Supabase stack (the CLI is installed as a dev dependency).

```bash
npm install
npm run db:start   # local Supabase: Postgres, Auth, API, Mailpit. Applies supabase/migrations.
npm run db:env     # writes .env.local with the local URL and publishable key
npm run dev
```

Open http://localhost:3000 and create an account. Confirmation and password-reset emails are caught by Mailpit at http://127.0.0.1:54324 (nothing is really sent). Use `localhost`, not `127.0.0.1`, in the browser: email links point to `site_url` in `supabase/config.toml`.

Other database commands:

```bash
npm run db:reset   # recreate the local database from migrations (deletes local data)
npm run db:types   # regenerate types/database.ts after changing migrations
npm run db:stop
```

Storage is required from Phase 4 (vision-board images). To skip the services the app does not use (faster start, less disk):
`npx supabase start -x realtime,imgproxy,edge-runtime,logflare,vector,supavisor,studio,postgres-meta`

### Checks

```bash
npm run lint
npm run typecheck
npm run format:check
npm test                  # unit tests (tests/unit)
npm run test:integration  # RLS/isolation tests against the running local stack (tests/integration)
npm run build
npm run test:e2e          # Playwright auth journey; needs the local stack, .env.local, and a build
```

The integration tests refuse to run against anything other than `localhost`/`127.0.0.1`, because they create and delete users with the local stack's secret key. CI runs all of the above, including a check that `types/database.ts` matches the migrations.

## Supabase setup (hosted project)

1. Create a project at https://supabase.com/dashboard.
2. Apply the migrations from this repository (never edit the schema only in the dashboard):
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push --dry-run   # lists the migrations that would run; changes nothing
   npx supabase db push             # applies them
   ```
   See "Applying a new migration to a hosted project" below before pushing to a project that already has data.
3. **Authentication → URL Configuration:** set _Site URL_ to your app origin (e.g. `https://your-app.vercel.app`) and add `http://localhost:3000/**` and `https://your-app.vercel.app/**` to _Redirect URLs_.
4. **Authentication → Sign In / Providers → Email:** keep _Confirm email_ enabled, and set the minimum password length to 8.
5. **Authentication → Emails → Templates:** replace the _Confirm signup_ and _Reset password_ templates with `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`. They link to `/auth/callback` with a token hash, so links work even when opened on another device. (With the default templates, links work only in the browser that started the flow.)
6. Hosted Supabase's built-in email sender is heavily rate-limited and intended for testing; configure custom SMTP before real use.
7. Copy the project URL and **publishable** key (Project Settings → API Keys) into `.env.local` or Vercel environment variables as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and set `NEXT_PUBLIC_APP_URL`. Never put the secret/service-role key in this app's environment.
8. Sign up with two accounts and confirm neither can see the other's data. The automated version of this check is `npm run test:integration`.

The private `vision-board` Storage bucket and its policies are created by the Phase 4 migration; nothing has to be set up in the dashboard. Don't make the bucket public.

### Applying a new migration to a hosted project

Migrations are never applied to a hosted project automatically (not by CI and not by the app). To apply new ones, such as Phase 4's `20261014090000_habits_goals_vision.sql` and `20261015090000_notes_and_journal.sql`:

1. **Back up first.** The Free plan has no managed backups you can restore yourself. Run `npx supabase db dump --linked -f backup-schema.sql` and `npx supabase db dump --linked --data-only -f backup-data.sql`, and keep the files outside the repository. They contain your personal data.
2. `npx supabase db push --dry-run` lists the pending migrations without changing anything.
3. `npx supabase db push` applies the pending migrations in order, each in its own transaction, and records them in `supabase_migrations.schema_migrations` so they never run twice.

What `20261015090000_notes_and_journal.sql` (Phase 4, part 2) does to a hosted database:

- It **adds** four tables (`notes` and `note_tags`; `journal_entries` and `journal_entry_tags`) with indexes, `updated_at` triggers on `notes` and `journal_entries`, column grants, and RLS policies, plus two functions (`set_note_tags`, `set_journal_tags`) that mirror the existing tag helpers. Notes carry nullable `project_id`/`goal_id`/`task_id` composite foreign keys (deleting the linked record keeps the note).
- It does **not** change or delete existing tables, rows, or policies. Undo: restore from backup, or a new migration that drops the four tables and two functions (this deletes all notes and journal entries).
- Deploy the matching app version after it succeeds.

What `20261014090000_habits_goals_vision.sql` (Phase 4, part 1) does to a hosted database:

- It **adds** three enums; five tables (`habits`, `habit_logs`, `goals`, `milestones`, `vision_board_items`) with indexes, `updated_at` triggers, column grants, and RLS policies; nullable `goal_id` columns on `projects`, `tasks`, and `plan_items`, plus `plan_items.milestone_id` and `ideas.converted_goal_id`; the functions `convert_idea_to_goal` and `add_goal_to_plan`; two `private` helpers; the private `vision-board` Storage bucket (5 MB, images only); and four policies on `storage.objects` limited to that bucket.
- It **replaces** two existing objects: the `plan_items` check that a plan item links exactly one task or project now allows exactly one task, project, goal, or milestone (existing rows already satisfy it), and `private.tasks_create_next_occurrence` now also copies `goal_id` to the next occurrence of a recurring task.
- It does **not** delete or rewrite existing rows. Undo: restore from backup, or a new migration that drops the new objects (this deletes all habits, goals, milestones, and cards; uploaded images must be removed from the bucket separately) and restores the previous check and function.
- Deploy the matching app version after it succeeds.

What `20261013090000_google_calendar.sql` does to a hosted database:

- It **adds** two enums, two tables (`google_calendar_connections` for encrypted tokens and the calendar choice, `time_block_sync` mapping each synced block to its Google event), indexes, `updated_at` triggers, column grants, RLS policies, and one `private` helper function. It is needed because there was nowhere to keep tokens or per-block sync state; `time_blocks.external_event_id` is reserved for imported events.
- It does **not** change existing tables, rows, or policies. Undo: restore from backup, or a new migration that drops the two tables (this deletes stored Google connections; events in Google are untouched).

What Phase 3's first migration (`20261012120000_time_blocks.sql`) does to a hosted database:

- It **adds** the `time_block_origin` enum, the `time_blocks` table with its indexes, `updated_at` trigger, grants, and RLS policies, and two functions (`add_task_to_plan`, `add_project_to_plan`) that create a task/project and link it to a plan in one transaction.
- It does **not** change or delete existing rows, tables, or policies. Rollback works the same as below (restore from backup, or a new migration that drops `time_blocks`, which deletes all time blocks).

What Phase 2's migration does to a hosted database:

- It **adds** new types, tables, indexes, functions, triggers, and RLS policies. It enables the `pg_trgm` extension (in the `extensions` schema) and adds one unique constraint, `areas (id, workspace_id)`, which existing rows already satisfy.
- It does **not** delete or rewrite existing rows, and it changes no Phase 1 policies.
- Re-running `db push` after success does nothing. If it fails partway, the failing migration is rolled back and not recorded; fix the cause and push again.
- There is no automatic "down" migration. Undoing it means restoring from your backup, or writing a new migration that drops the new objects (which deletes all tasks, projects, ideas, and plans).
- Deploy the matching app version after the migration succeeds. The old app keeps working against the new schema, but the new app needs the new tables.

## Google Calendar (optional)

Google Calendar is off unless `GOOGLE_CALENDAR_INTEGRATION_ENABLED=true` **and** every variable below is valid; otherwise Settings explains what is missing and the rest of the app, including manual scheduling, works as before. Nothing here is a `NEXT_PUBLIC_*` variable, and none of it reaches the browser.

1. In [Google Cloud Console](https://console.cloud.google.com/): create a project, enable the **Google Calendar API**, and configure the **OAuth consent screen** (External; add yourself as a test user while the app is in "Testing").
2. Add these scopes to the consent screen. They are the narrowest that work: list your calendars, and manage events only on calendars you own.
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/calendar.events.owned`
3. Create an **OAuth client ID** of type _Web application_ with authorized redirect URIs `http://localhost:3000/api/integrations/google-calendar/callback` and `https://YOUR_DOMAIN/api/integrations/google-calendar/callback`.
4. Set server-side environment variables (`.env.local`, or Vercel → Project Settings → Environment Variables; never `NEXT_PUBLIC_`):
   - `GOOGLE_CALENDAR_INTEGRATION_ENABLED=true`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` exactly as registered (https, or http only for localhost)
   - `GOOGLE_TOKEN_ENCRYPTION_KEY`: `openssl rand -base64 32`. Keep it secret and stable: changing it makes stored tokens unreadable, and each user then sees "Reconnect Google Calendar".
5. Apply `20261013090000_google_calendar.sql` (see "Applying a new migration to a hosted project"), deploy, and connect from **Settings → Google Calendar**.

While the consent screen is in "Testing", Google expires refresh tokens after 7 days, so you will be asked to reconnect weekly; publishing (and, for these sensitive scopes, Google's verification) removes that limit.

How it is protected:

- **OAuth:** authorization-code flow with PKCE. The `state` and PKCE verifier live in an encrypted, httpOnly, single-use cookie bound to your user and workspace and valid for 10 minutes; the callback rejects anything else and always redirects to a fixed Settings URL. If you untick a calendar permission on Google's consent screen, the connection is refused and the token revoked.
- **Tokens:** refresh and access tokens are encrypted with AES-256-GCM on the server (key derived from `GOOGLE_TOKEN_ENCRYPTION_KEY`, ciphertext bound to the workspace and user) before they are stored. They are never sent to the browser, logged, or put in URLs. RLS limits the rows to the user who connected; even that user only ever sees ciphertext.
- **Idempotency:** each block maps to one fixed Google event ID (the block's UUID). Inserting it twice returns "already exists", which becomes an update; deleting an already-deleted event counts as success. Sync detects changes by comparing each block's `updated_at` with the version last sent, so interrupted runs, retries, concurrent tabs, and disconnect/reconnect never create duplicates (covered by `tests/integration/google-calendar.test.ts`).
- **Failures:** revoked or expired access stops sync and asks you to reconnect; rate limits back off (`Retry-After`, default 60 s) for automatic runs; outages mark the affected blocks as failed and retry later. In every case your blocks stay saved in Yawm.
- **Privacy:** only a block's title, start, end, and timezone are sent, plus a private back-reference ID. Notes, tasks, journals, ideas, and habits never go to Google.
- **Tests:** automated tests never call Google. `tests/support/fake-google.ts` simulates the OAuth and Calendar endpoints; browser tests serve it on `127.0.0.1:4010` via `GOOGLE_API_ORIGIN_OVERRIDE`, which the app accepts only for loopback addresses.

## Deploying to Vercel

1. Push the repository to GitHub.
2. Import it into Vercel.
3. Add the same required environment variables in Vercel Project Settings.
4. Configure Supabase production redirect/site URLs to match the deployed domain.
5. Deploy and run the production smoke-test checklist from `IMPLEMENTATION_PLAN.md`.

## Backups and free-tier limitations

- Browser-local snapshots are not a replacement for an independent downloadable backup.
- Use the app's full export regularly and test restore before relying on it.
- Review current Vercel and Supabase plan terms before public or commercial use; free tiers have limits and can change. Supabase Free projects may pause after a period of low activity and do not include the same managed daily backup features as paid plans.

## Environment variables

See `.env.example`. Never commit `.env.local` or any real secrets.
