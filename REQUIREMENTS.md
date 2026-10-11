# Personal Productivity OS — Product & Technical Requirements

**Document status:** Initial specification for Claude Code  
**Product stage:** Personal MVP, designed to expand to more users later  
**Primary language:** English  
**Initial hosting target:** Vercel Hobby + Supabase Free, subject to provider limits  
**Design reference:** Todoist's clear, compact task-oriented interface; do not copy its branding or proprietary UI assets

---

## 1. Product vision

Build a responsive personal productivity web app that connects long-term direction to daily execution. It should feel like a personal command center—not a collection of unrelated mini-apps.

The app should help the user move through this loop:

1. **Capture:** Empty the mind into a fast idea inbox.
2. **Clarify:** Sort ideas into goals, projects, tasks, notes, or “someday.”
3. **Prioritize:** Choose the most important outcomes and tasks.
4. **Plan:** Connect yearly, monthly, weekly, and daily plans; schedule work into time blocks.
5. **Execute:** Work through tasks, habits, routines, and focus sessions.
6. **Reflect:** Journal, review progress, and improve the next plan.

### Product principles

- Low-friction capture and a clear “what matters now?” view.
- Connected data: plans, goals, projects, tasks, calendar blocks, and reviews should link to each other.
- Calm, compact, useful UI inspired by Todoist's clarity.
- Reliable persistence and explicit save/sync states.
- Private-by-default personal workspaces.
- Architecture that supports collaboration later without requiring it in the first release.
- Affordable to develop and operate; avoid paid APIs unless explicitly approved.
- No dedicated religious workflow is required. The user will model any routines using custom habits, tasks, projects, and time blocks.

## 2. Architecture decision (important)

The user's requirements include the same data across laptop and phone, account-based access, separate private workspaces, and future collaboration. A database that exists only on one computer or in one browser cannot meet all of these needs by itself.

### Chosen baseline

- **Web app:** Next.js App Router + React + TypeScript.
- **Hosting:** Vercel Hobby for personal/non-commercial use within current plan limits.
- **Primary database:** Supabase-managed PostgreSQL.
- **Authentication:** Supabase Auth.
- **Authorization:** PostgreSQL Row Level Security (RLS) policies on every user/workspace-scoped table.
- **Image storage:** Supabase Storage, restricted to authenticated workspace members.
- **Local persistence:** IndexedDB through Dexie for browser-local snapshots, offline drafts/queue where supported, and resilient local cache. IndexedDB is not the source of truth.
- **Calendar provider:** Google Calendar API as an optional integration using OAuth 2.0.
- **Source control:** GitHub; schema migrations and application code live in the repository.

### Data boundary

Supabase is the canonical source of truth. Changes made while online are saved to Supabase. Local IndexedDB supports recovery and limited offline resilience, but local changes must be clearly marked as pending until confirmed by the server.

Do not describe the primary database as “local.” The cloud database is the deliberate trade-off for cross-device synchronization and future collaboration. If exclusive on-device/local-server storage becomes a hard requirement, revisit the architecture rather than silently mixing two competing sources of truth.

### Free-tier caveat

The free hosting/database tiers are suitable for a small personal MVP, not a guarantee of permanent free production hosting. Current provider limits can change. Supabase Free projects may be paused after a week of low activity, and the Free plan does not include the same managed automatic backup features as paid plans. The application must therefore offer its own user-controlled full backup/export workflow and automatic browser-local snapshots. Review provider pricing and limits before public launch or monetization.

## 3. Users, workspaces, and permissions

### Version 1

- A user can register/sign in, sign out, reset a password, and manage their profile.
- On first sign-in, create a private personal workspace for that user.
- Each user sees only workspaces they belong to.
- The MVP UI does not need shared workspaces or real-time collaborative editing yet.
- Database schema and authorization must nevertheless support multiple workspaces and future roles.
- The app must never rely on hiding UI controls as its only security measure; enforce access in RLS.

### Future-ready roles

Support a future workspace membership model with roles such as `owner`, `admin`, `member`, and `viewer`. Do not implement a complex invitation/permission UI until the collaboration phase, but design the schema so a project or workspace can be shared later without rewriting every table.

### Authentication assumptions

Use email/password authentication with email verification and password reset. Keep registration/invitation policy configurable. Do not expose service-role credentials in browser code. Use Supabase's publishable key with correctly configured RLS; privileged server-only keys should not be needed for normal user CRUD.

## 4. Target devices and offline behavior

- Responsive desktop and mobile layouts.
- Same account data available across devices when online.
- PWA-capable app shell with HTTPS and suitable manifest/icons.
- Online-first for version 1 because the user's offline requirement is undecided.
- When offline, show an unmistakable status indicator, preserve in-progress form drafts and quick-capture drafts locally where practical, and queue only operations for which conflict behavior is defined.
- Do not claim full offline multi-device synchronization in v1.
- On reconnect, retry pending operations safely and idempotently; never silently overwrite newer server data.

## 5. Information architecture and navigation

Primary navigation:

1. Dashboard
2. Inbox / Brainstorming
3. Today
4. Planner
5. Tasks
6. Projects
7. Habits
8. Goals & Vision Board
9. Notes
10. Journal
11. Reviews & Statistics
12. Settings

Use a collapsible sidebar on desktop and compact/mobile navigation on small screens. Global text search is required; a command palette is not required. Add a persistent quick-capture action for an idea or task.

## 6. Feature requirements

### 6.1 Dashboard — personal command center

Show configurable sections for:

- Current date and a concise overview.
- Today's top priorities and planned time blocks.
- Due today, overdue, and upcoming tasks.
- Today's habits and completion status.
- Active projects and project progress.
- Active goals and milestone progress.
- Quick capture for a task or idea.
- A journal/reflection prompt.
- Focus timer shortcut and recent focus session.
- Lightweight trends, completion rate, and weekly progress.

Keep the initial dashboard useful at a glance. Charts must answer a practical question and must not crowd out today's actions. Widget customization can be basic in v1 (show/hide and sensible ordering).

### 6.2 Brainstorming / idea inbox

The inbox is the starting point of the user's workflow. It must be fast enough to capture a thought without completing a form.

An idea supports title, text content, status (`inbox`, `developing`, `someday`, `archived`), tags, created/updated timestamps, and optional links to a goal/project/task.

Required actions:

- Quick-create with a title and optional body.
- Edit, search, tag, archive, and delete.
- Filter by status/tag.
- Convert an idea into a task, project, or goal without losing its original content.
- Link an idea to existing work.
- Bulk triage can be deferred if it expands scope materially.

No mind-map canvas or collaborative whiteboard in v1.

### 6.3 Goals and vision board

Support long-term outcomes and a visual representation of the user's direction.

A goal supports title, description, why it matters, life area, status, start/target dates, optional measurable target, milestones, and links to projects/tasks.

Vision-board cards support an image, short text, and optional link to a goal. Images are the only planned file attachments in v1; journal entries, notes, ideas, and goals should otherwise be text-based. Store images in Supabase Storage and keep storage paths/metadata in the database. Apply authenticated access rules; do not expose private images through public buckets.

Required actions:

- Create/edit/archive goals and milestones.
- Display cards in a visual grid.
- Reorder cards.
- Upload/replace/remove a card image.
- Open a goal and see milestones, linked projects, and linked tasks.
- Allow text-only goal cards when no image is supplied.

A free-form canvas with resizable/positionable elements is out of scope for v1.

### 6.4 Planning hierarchy: yearly, monthly, weekly, daily

Planning periods must be linked, not isolated pages.

- **Yearly:** choose themes, outcomes, key goals, and life-area emphasis.
- **Monthly:** select goals/milestones to advance and projects to prioritize.
- **Weekly:** define focus outcomes and top priorities; review unfinished work.
- **Daily:** select priorities, place tasks into available time, and review the result.

Use persistent plan records where the user enters a focus/theme/reflection, but derive task lists and calendar displays from linked tasks and time blocks to avoid duplicated state.

Required behavior:

- Navigate between periods and return to the current period.
- Link goals/projects/tasks into a plan.
- Display progress flowing from goals → projects/milestones → tasks → time blocks.
- Provide an explicit “carry forward/reschedule” flow for unfinished tasks; do not silently move deadlines.
- Distinguish a task deadline from a scheduled work block.
- Respect the user's timezone and week-start preference.

### 6.5 Tasks

A task supports:

- Title and optional text description/notes.
- Status: `todo`, `in_progress`, `done`, `cancelled`.
- Priority: `low`, `medium`, `high`, `urgent`.
- Due date and optional due time.
- Scheduled start/end time through calendar time blocks.
- Estimated duration.
- Subtasks via parent-task relationship.
- Optional project, life area, and goal links.
- Tags.
- Recurrence rule.
- Dependencies on other tasks.
- Created/updated/completed timestamps.

Required views/actions:

- List and Kanban views.
- Create/edit/complete/reopen/archive/delete.
- Filter, sort, and group by date/status/priority/project/area/tag.
- Search tasks.
- Create recurring tasks with common patterns (daily, weekly, selected weekdays, monthly); validate edge cases.
- Display overdue state only for incomplete tasks.
- Prevent accidental cascading deletion of linked records; use confirmations and defined archive/delete behavior.
- Support keyboard-accessible quick add without requiring a command palette.

### 6.6 Projects and life areas

Projects group tasks toward an outcome. Fields: name, description, status (`planned`, `active`, `on_hold`, `completed`, `archived`), optional start/due dates, life area, linked goals, notes, and derived progress.

Provide these default life areas, editable by the user:

- Spiritual
- Mental
- Physical
- Finances

Allow users to create, rename, recolor, reorder, and archive areas. Do not hard-code business logic that only works for four areas.

### 6.7 Habits

Support both binary and measurable habits.

Fields include title, description, life area, habit type (`boolean` or `measurable`), target value/unit when measurable, schedule/frequency, active period, optional reminder time, and archive status.

Required behavior:

- Daily or selected-weekday schedules.
- Explicit rest/non-scheduled days.
- Mark/unmark completion for a date and edit a numeric value.
- Current and longest streaks.
- Weekly/monthly completion rates and a calendar heatmap.
- Correct calculations across timezone/daylight-saving boundaries as applicable.
- Editing historic logs must recalculate streaks correctly.
- Never count a scheduled rest day as a failure.
- Allow custom habits for any domain; no hard-coded prayer/Qur'an screens are required.

### 6.8 Calendar and time blocking

Provide day, week, month, and agenda views; a 24-hour daily timeline; create/edit/delete/move time blocks; and drag-and-drop rescheduling where the library supports it accessibly.

A time block has title, start/end datetime, optional task/project association, timezone context, provider origin, and external calendar event ID when synchronized.

Requirements:

- Scheduled task blocks are different from deadlines.
- Warn about overlapping blocks but allow the user to override where reasonable.
- Offer to reschedule or carry forward incomplete work.
- Display external Google Calendar events as read-only busy blocks in v1, when connected.
- Sync app-created time blocks to one selected Google Calendar in v1 (one-way write from this app); persist event IDs to prevent duplicates.
- Full bidirectional editing/conflict resolution is future work unless explicitly approved later.
- Connection/disconnection, permission revocation, expired token, and sync errors must have clear states.
- Google OAuth secrets and refresh tokens must never be exposed in browser bundles or logs. Encrypt stored refresh tokens using a server-side key, and request the narrowest OAuth scopes that support the feature.
- Google integration is optional; the app works if OAuth environment variables are absent.

### 6.9 Google Calendar integration

Treat this as an optional integration and implement behind a feature flag.

Minimum v1 behavior:

1. User initiates Google Calendar connection.
2. OAuth callback is validated using a secure state/CSRF mechanism.
3. User chooses a target calendar.
4. App-created time blocks can be sent to the target calendar.
5. Existing external events can be fetched for read-only visibility/conflict avoidance, subject to granted permissions.
6. Store an external event identifier and sync status for each synchronized time block.
7. Handle retries idempotently and show errors in the UI.
8. Allow disconnecting and deleting/revoking locally stored tokens.

Do not sync journals, private notes, habit logs, or idea content to Google Calendar. Only send fields necessary for calendar events.

### 6.10 Notes

Provide a simple text-first notes area for information that is not a dated journal entry or an actionable task. Fields: title, body, tags, optional links to a project/goal/task, created/updated timestamps. Search, edit, archive, and delete. Rich collaboration and file attachments are out of scope.

### 6.11 Journal and reflection

A dated journal entry supports title, text body, optional mood, optional energy rating, optional tags, and optional prompt. Include a simple daily template with configurable prompts, such as:

- What mattered today?
- What went well?
- What did I learn?
- What should change tomorrow?
- What am I grateful for?

Requirements:

- Autosave with a visible state (`saving`, `saved`, `offline draft`, or `error`).
- Browse entries by date/month and search title/body.
- Multiple entries on one date are allowed.
- Edit/delete with confirmation where appropriate.
- Journal text must never be sent to an AI provider, analytics provider, or other third-party service in v1.
- No file attachments in journal entries.

### 6.12 Focus timer / Pomodoro

- Configurable focus and break durations.
- Start, pause, resume, skip, and cancel.
- Optional link to a task.
- Persist completed focus sessions (start/end, elapsed duration, task, session type).
- Recover gracefully after a tab reload; do not rely on a JavaScript timer being continuously alive.
- Provide a lightweight daily/weekly summary of completed focus time.
- Browser notifications are not required in v1; in-app state is sufficient.

### 6.13 In-app reminders

Provide an in-app reminder center for due tasks and selected habit/time-block reminders. Reminders appear while using the app and are derived from persisted schedules. Do not promise reminders when the website is closed unless a supported push/background system is implemented later.

Avoid duplicate reminders on refresh; use stable IDs and mark-as-read/dismissed state. Provide a setting to turn reminder categories on/off.

### 6.14 Weekly review and statistics

A weekly review should combine quantitative summaries with reflection prompts.

Include:

- Completed tasks and carried-forward tasks.
- Habit completion rates (only on scheduled days).
- Focus time.
- Goal/project progress.
- What went well, what did not, lessons, and next week's priorities.

Statistics should have clear date ranges and definitions. Do not imply that completion percentage is a direct measure of personal worth or overall productivity.

## 7. Data model requirements

Use UUIDs for application records, explicit foreign keys, created/updated timestamps, and migration-managed database changes. Store UTC instants as `timestamptz`; store date-only values as PostgreSQL `date`; use the user's configured IANA timezone to interpret day/week boundaries.

Expected tables/entities (Claude Code should refine the exact SQL schema before coding):

- `profiles`
- `workspaces`
- `workspace_members`
- `areas`
- `plans` and `plan_items`
- `goals` and `milestones`
- `projects`
- `tasks`, `task_dependencies`, and `task_tags` (or an equivalent normalized tag model)
- `habits` and `habit_logs`
- `time_blocks`
- `ideas`
- `notes`
- `journal_entries`
- `focus_sessions`
- `reminders` / in-app notifications
- `vision_board_items`
- `calendar_connections` and sync metadata

Every user-owned business record should carry a `workspace_id` or be linked unambiguously to a protected user/workspace record. All user/workspace tables must have RLS enabled and tested. Policies must verify current authenticated user membership in the row's workspace, with write permissions appropriate to the member role. Add indexes for workspace filtering, due dates, schedule ranges, foreign keys, and common search fields.

Avoid storing duplicate derived progress values unless there is a demonstrated performance reason. Calculate task/project/goal/habit progress from source records, or use a documented reliable aggregation strategy.

## 8. Local backups, portability, and data recovery

The user requested automatic local backups. Browser security restrictions mean a website cannot silently write arbitrary backup files to the device's filesystem across all browsers/devices.

Required practical implementation:

1. Automatically create versioned browser-local snapshots in IndexedDB while the user is signed in and the app is active (for example, no more than one snapshot per day plus before destructive imports/resets).
2. Keep a documented, configurable retention policy for local snapshots (default seven snapshots per account per browser), with UI to inspect/delete them.
3. Clearly label these as **browser-local snapshots**; clearing site data or losing the device can remove them.
4. Provide a user-triggered full workspace export to a downloadable ZIP/JSON package, including structured records and vision-board images where feasible.
5. Provide validated restore/import with preview, schema version checks, duplicate-ID handling, and explicit replace/merge choice.
6. Provide CSV export for tasks and Markdown export for journal entries.
7. Show backup timestamp and result; surface failed backups.
8. Do not claim the Supabase Free plan provides managed automatic database backups. Document how to create a separate backup before major releases or migrations.

## 9. Search

Provide a global search field without a command palette. Search tasks, projects, goals, ideas, notes, and journal entries. Respect workspace permissions, display entity type in results, debounce requests, and provide direct navigation. Keep journal content out of third-party search services.

## 10. UI/UX and accessibility

- English-only UI for v1.
- Todoist-inspired clarity: compact lists, clear typography, restrained color, visible priorities, quick actions, and predictable navigation.
- Do not copy Todoist branding or assets.
- Responsive desktop, tablet, and mobile layouts.
- Light/dark/system theme.
- Useful empty states, loading states, error states, save states, and offline indicator.
- Keyboard navigation, visible focus indicators, semantic labels, adequate contrast, and screen-reader-friendly form errors.
- Confirm destructive actions and make undo possible for safe actions when practical.
- Avoid excessive motion and chart clutter.

## 11. Security and privacy requirements

- RLS enabled and validated on all workspace-scoped data tables.
- Tests proving user A cannot read or mutate user B's workspace/data.
- Private storage buckets and authorization policies for vision-board images.
- Server-side validation for OAuth callbacks and sensitive actions.
- Never commit `.env.local`, API secrets, OAuth secrets, or token encryption keys.
- Never expose a Supabase service-role key in client-side code. Prefer not to use it at all.
- Keep Google refresh tokens server-side and encrypted at rest at the application layer.
- No trackers or analytics that record personal content in v1.
- Avoid logging journal, note, idea, or task bodies.
- Rate-limit or guard expensive import/search operations appropriately.
- Validate imported JSON/ZIP content, size, IDs, and schema version before writing.
- Implement account data export and account/workspace deletion flows with confirmation before public release.

## 12. Error handling and reliability

- Every asynchronous read/write action has loading, success, and error UI where relevant.
- Do not show “saved” before server confirmation for cloud writes.
- Use optimistic UI only where rollback/error handling is implemented.
- Use database transactions for related multi-row operations when supported.
- Make retryable operations idempotent.
- Handle expired auth sessions, network failures, quota errors, upload errors, token revocation, and rate limits.
- Prevent repeated submission from creating duplicate tasks, reminders, focus sessions, or calendar events.
- Add schema migrations; never change the database only through dashboard clicks without committing the migration to Git.

## 13. Testing requirements

At minimum, test:

- Authentication and private workspace creation.
- RLS isolation between users/workspaces.
- Task CRUD, status transitions, subtasks, dependencies, recurring rules, and due dates.
- Day/week/month/year boundaries and timezone behavior.
- Habit streaks, measurable targets, scheduled rest days, and historical edits.
- Planning links between periods, goals, projects, tasks, and time blocks.
- Google Calendar event idempotency, disconnect behavior, and error handling (mock API calls in automated tests).
- Focus timer recovery after reload.
- Snapshot retention and export/import round trips.
- Storage access control for vision-board images.
- Responsive navigation and critical flows in a real browser.

Use unit tests for business logic, integration tests for the data-access layer/RLS, and a small number of browser end-to-end tests for core journeys.

## 14. MVP boundaries

### Include in the first usable release

- Authentication and a private personal workspace.
- Dashboard and quick capture.
- Tasks, priorities, subtasks, recurring tasks, dependencies, tags, notes, and filters.
- Projects and editable life areas (with Spiritual, Mental, Physical, Finances defaults).
- Linked yearly/monthly/weekly/daily planning.
- Calendar/time blocks and Google Calendar integration behind an optional configuration flag.
- Boolean and measurable habits, streaks, rest days, and statistics.
- Goals, milestones, and image-based vision board.
- Brainstorming inbox.
- Text notes and daily journaling/reflection with mood/energy.
- Focus timer and session history.
- In-app reminders.
- Weekly review/statistics.
- Global search without command palette.
- Automatic IndexedDB snapshots, export, and restore.
- Basic PWA/offline status and safe local drafts.

### Defer until core features are reliable

- Shared workspace UI, member invitations, comments, live collaboration, and realtime presence.
- Full two-way Google Calendar editing/conflict resolution.
- Full offline edits for every entity and complex conflict merging.
- Free-form vision-board canvas/mind maps.
- Push notifications/background reminders.
- AI features, AI journal analysis, external productivity analytics.
- Billing/subscriptions, public social features, native mobile apps, and public marketplace launch.

The database must be collaboration-ready even though shared workspace UI is deferred.

## 15. Definition of done

The first release is not complete until:

- The app builds and deploys to Vercel from the Git repository.
- Authenticated users can only access records in workspaces they belong to.
- Core records persist across refresh, sign-out/sign-in, and supported devices.
- The planning hierarchy connects annual outcomes to goals/projects/tasks/time blocks.
- Habits correctly handle measurable values, streaks, and rest days.
- Journal/notes/ideas remain private and are not sent to external content processors.
- Vision-board images use private authorized storage.
- Google Calendar is optional and does not break the app when not configured.
- Local snapshots and downloadable backup/restore are tested end-to-end.
- Critical date, recurrence, import/export, RLS, and sync paths have automated tests.
- The UI works on desktop and mobile, including clear error, offline, and save states.
- Setup, environment variables, Supabase migrations, deployment, backup/restore, and known free-tier limitations are documented.

## 16. Official references

- Next.js: https://nextjs.org/docs
- Supabase Next.js Auth: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase pricing and limits: https://supabase.com/pricing
- Supabase Free project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Google Calendar API: https://developers.google.com/workspace/calendar/api/guides/overview
