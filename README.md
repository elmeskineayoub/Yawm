# Personal Productivity OS

A planning and self-management app for tasks, connected yearly-to-daily plans, projects, habits, goals, a vision board, brainstorming, notes, journaling, time blocking, focus sessions, and weekly reviews.

This repository is being implemented phase-by-phase from `IMPLEMENTATION_PLAN.md`. Phases 0–2 are done and Phase 3 is partly done: you can capture ideas, manage tasks and projects, plan years, months, weeks, and days in one Planner, and schedule work on an interactive calendar. Google Calendar sync, habits, goals, journaling, focus, and backups come in later phases.

## Current status

| Phase                                   | Status                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Foundation                          | Done: Next.js 16 App Router, TypeScript strict, Tailwind v4, ESLint, Prettier, Vitest, GitHub Actions CI, app shell, light/dark/system theme, `/api/health`        |
| 1 — Supabase auth & workspace isolation | Done: email/password auth with verification and reset, protected routes, personal workspace + default areas, RLS with integration tests                            |
| 2 — Core execution                      | Done: inbox, tasks (subtasks, dependencies, recurrence, tags), projects, editable life areas, connected plans, Today, dashboard, quick capture                     |
| 3 — Planning & calendar                 | Partly done: redesigned Planner (Day/Week/Month/Year), manual time blocks with drag-and-drop scheduling, rescheduling, carry-forward. Google Calendar sync is next |
| 4+                                      | Not started                                                                                                                                                        |

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
- **Rescheduling:** the day or week that contains today lists **Needs rescheduling** — open tasks whose block has passed, or whose deadline has passed — with explicit actions: schedule a new block, move the deadline (today / tomorrow / next week / a date), or add to today's priorities. **Carry forward** links a period's unfinished priorities to the next period (originals stay, deadlines unchanged, running it twice does nothing new).
- **Profile** (Settings): edit your name, timezone, and week start.
- **Today:** today's priorities (the day plan's linked work), today's scheduled blocks, overdue, due today, and completed today. Task pages list their scheduled time.
- **Dashboard:** counts for overdue, due today, inbox, and active projects; today's priorities; this week's theme and completed tasks; needs attention; upcoming 7 days; active project progress.
- Loading skeletons, empty states, error boundaries with retry, confirmation dialogs for deletes, and "Saving… / Saved" shown only after the server confirms.

### Security model

Schemas: `supabase/migrations/20261011230000_identity_and_workspaces.sql` (Phase 1), `supabase/migrations/20261012090000_core_execution.sql` (Phase 2), and `supabase/migrations/20261012120000_time_blocks.sql` (Phase 3).

| Table                                                                                                               | Read                           | Write from the browser/API                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                                                                                                          | own row                        | update own `display_name`, `timezone`, `week_start`                                                                                                                               |
| `workspaces`                                                                                                        | workspaces you are a member of | owner/admin may rename                                                                                                                                                            |
| `workspace_members`                                                                                                 | members of your workspaces     | none (bootstrap trigger only)                                                                                                                                                     |
| `areas`, `tags`, `projects`, `tasks`, `task_tags`, `task_dependencies`, `ideas`, `idea_tags`, `plans`, `plan_items` | your workspaces                | owner/admin/member insert/update/delete; viewers read-only                                                                                                                        |
| `time_blocks`                                                                                                       | your workspaces                | owner/admin/member insert/update/delete of app-created blocks only; blocks with `origin = 'google'` are read-only, and `origin` / external event IDs cannot be written by clients |

- RLS is enabled on every table, in the same migration that creates it.
- Every reference between rows is a composite foreign key on `(id, workspace_id)`, so a row can only point at rows in its own workspace, even with a guessed UUID.
- Server actions also scope every ID-based update and delete (and the idea-conversion and tag functions) to the active workspace resolved on the server, so a member of several workspaces cannot change another workspace's rows by passing their IDs from this one. Those writes live in `features/*/mutations.ts` and are covered by `tests/integration/active-workspace-scope.test.ts`.
- Table and column privileges are granted explicitly: `workspace_id` can never be changed, and trigger-managed columns (`completed_at`, recurrence series fields) cannot be written by clients.
- Database functions called from the app (`convert_idea_to_task/project`, `set_task_tags`, `set_idea_tags`, `add_task_to_plan`, `add_project_to_plan`) run with the caller's permissions, so RLS applies. Membership checks are `security definer` helpers in a non-exposed `private` schema.
- `anon` (signed-out) has no privileges on any of these tables.
- The app uses only the publishable key. No service-role/secret key is used by the app; integration tests use the local stack's secret key only to create test users.
- Task, idea, and project content is never logged or sent to third parties.

Known limitations / notes:

- **Google Calendar** sync (OAuth, importing external events read-only, one-way export of blocks) is not built yet; it is the next Phase 3 pull request. The `time_blocks` table already has `origin` and external event ID columns for it.
- Time blocks don't repeat, are limited to 24 hours, and aren't shared between workspaces. Rescheduling is always an explicit action; nothing moves on its own.
- Dragging on the calendar needs a mouse or touch. Keyboard users can do the same through the **Schedule** buttons and the block side panel.
- The Unscheduled tray lists open tasks with no upcoming block (this period's priorities first; a short list with "Show all"). Scheduling data considers at most the 500 open tasks with the nearest deadlines.
- The Planner's month grid shows blocks and deadlines but not plan priorities of individual days.
- **Global search** across all entities is not built yet; Tasks and Inbox each have their own search (title and notes).
- **Recurrence:** the next occurrence is created on completion (not pre-generated), so future occurrences don't appear until then. Subtasks and dependencies are not copied to the next occurrence. Rules are daily/weekly/monthly; no yearly or "last weekday of the month" rules.
- Saving a task's details and its tags are two server calls; if the tag update fails, the form says so and the details are already saved.
- No drag-and-drop on the board yet (status picker instead); no manual ordering of tasks.
- Tags are created from the task/idea forms; there is no screen to rename or delete tags yet.
- The Tasks list shows at most the 1,000 most recently created matching tasks (all filters, including tags, run in the database first); the page then says how many matched in total. The Inbox is paginated, 50 ideas per page.
- Workspace creation, switching, and membership management (invites) are not exposed yet; the schema supports multiple workspaces and roles for the collaboration phase.
- Account and workspace deletion flows are not built (required before public release).
- `NEXT_PUBLIC_*` values are inlined at build time; rebuild/restart after changing `.env.local`.
- `npm audit` reports high-severity advisories in `braces`/`micromatch`/`fast-glob` pulled in by `eslint-config-next` (lint-time dev dependency only, not shipped to the browser). The only automated "fix" downgrades to Next 14 lint config, so it is left until upstream updates.
- Dependencies for later phases (Dexie, googleapis, etc.) are declared in `package.json` but unused until their phase.

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

To skip services this phase does not use (faster start, less disk):
`npx supabase start -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,studio,postgres-meta`

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

Still to come in later phases: a private Storage bucket and policies for vision-board images (Phase 4).

### Applying a new migration to a hosted project

Migrations are never applied to a hosted project automatically (not by CI and not by the app). To apply a new one, such as Phase 3's `20261012120000_time_blocks.sql`:

1. **Back up first.** The Free plan has no managed backups you can restore yourself. Run `npx supabase db dump --linked -f backup-schema.sql` and `npx supabase db dump --linked --data-only -f backup-data.sql`, and keep the files outside the repository. They contain your personal data.
2. `npx supabase db push --dry-run` lists the pending migrations without changing anything.
3. `npx supabase db push` applies the pending migrations in order, each in its own transaction, and records them in `supabase_migrations.schema_migrations` so they never run twice.

What Phase 3's migration (`20261012120000_time_blocks.sql`) does to a hosted database:

- It **adds** the `time_block_origin` enum, the `time_blocks` table with its indexes, `updated_at` trigger, grants, and RLS policies, and two functions (`add_task_to_plan`, `add_project_to_plan`) that create a task/project and link it to a plan in one transaction.
- It does **not** change or delete existing rows, tables, or policies. Rollback works the same as below (restore from backup, or a new migration that drops `time_blocks`, which deletes all time blocks).

What Phase 2's migration does to a hosted database:

- It **adds** new types, tables, indexes, functions, triggers, and RLS policies. It enables the `pg_trgm` extension (in the `extensions` schema) and adds one unique constraint, `areas (id, workspace_id)`, which existing rows already satisfy.
- It does **not** delete or rewrite existing rows, and it changes no Phase 1 policies.
- Re-running `db push` after success does nothing. If it fails partway, the failing migration is rolled back and not recorded; fix the cause and push again.
- There is no automatic "down" migration. Undoing it means restoring from your backup, or writing a new migration that drops the new objects (which deletes all tasks, projects, ideas, and plans).
- Deploy the matching app version after the migration succeeds. The old app keeps working against the new schema, but the new app needs the new tables.

## Google Calendar (optional)

Google Calendar is disabled until configured. Create a Google OAuth 2.0 Web client, add the local and production callback URLs, then set the `GOOGLE_*` variables in local/Vercel server environment settings. `GOOGLE_CLIENT_SECRET` and `GOOGLE_TOKEN_ENCRYPTION_KEY` must remain server-only. Do not enable the feature until token encryption, OAuth state validation, event idempotency, and revocation handling are tested.

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
