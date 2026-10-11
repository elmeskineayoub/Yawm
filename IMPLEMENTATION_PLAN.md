# Implementation Plan

Build the application in small, testable phases. Do not generate the whole application in one pass.

## Phase 0 — Confirm the foundation

- Inspect repo and installed Node/npm versions.
- Create/verify the Next.js App Router, TypeScript strict mode, Tailwind v4, lint/test configuration, and app shell.
- Ensure `.env.local`, build artifacts, test output, and secrets are ignored by Git.
- Add a simple `/health` or equivalent non-sensitive readiness route only if useful; never expose secrets or database details.
- Run lint, typecheck, test, and build scripts successfully.

**Exit criteria:** a clean app builds locally with placeholder configuration and has a documented setup path.

## Phase 1 — Supabase, authentication, workspace isolation

- Create Supabase browser/server clients using the current official Next.js SSR approach.
- Add migrations for profiles, workspaces, workspace members, and default life areas.
- Add RLS policies and integration tests for user isolation.
- Implement login, sign-up, email verification callback, sign-out, password reset, and protected app routes.
- Create a private personal workspace and default areas on first successful account setup.
- Document Supabase project setup and local environment configuration.

**Exit criteria:** two test users cannot view or mutate each other's workspace, even by direct API calls.

## Phase 2 — Core execution: inbox, tasks, projects, plans

- Implement quick capture and idea triage.
- Add tasks, subtasks, statuses, priorities, tags, dependencies, deadlines, estimates, recurrence, and project links.
- Add projects and editable life areas.
- Add yearly/monthly/weekly/daily plan records and linked plan items.
- Add Today view, task list/Kanban, filters, and dashboard basics.
- Test recurrence, status transitions, dependencies, and plan links.

**Exit criteria:** ideas can become work items and plans connect top-level goals to actionable tasks.

## Phase 3 — Calendar and time blocking

- Implement day/week/month/agenda views and 24-hour daily timeline.
- Add create/edit/move time blocks and task associations.
- Implement rescheduling/carry-forward flow for unfinished tasks.
- Add overlap warnings and timezone-safe behavior.
- Add Google Calendar connection behind the environment feature flag, OAuth state validation, encrypted token storage, one-way push of app blocks, read-only display of external events, and sync idempotency.
- Keep the calendar usable when Google credentials are absent.

**Exit criteria:** manual calendar operations work without Google; optional sync does not duplicate events and degrades safely when disconnected.

## Phase 4 — Habits, goals, vision board, notes, journal

- Implement boolean/measurable habits, schedules, rest days, logs, streaks, and statistics.
- Implement goals and milestones, with links to projects/tasks/plans.
- Add private Supabase Storage for vision-board images.
- Implement text-first Notes and date-based Journal with prompt templates, mood/energy, autosave, and search.
- Verify content privacy and storage policies.

**Exit criteria:** every module persists data, respects RLS, and has meaningful empty/loading/error/save states.

## Phase 5 — Focus, reminders, weekly review, dashboard insights

- Add a reload-resilient Pomodoro/focus timer and focus-session history.
- Add in-app reminders without promising closed-browser notifications.
- Add weekly review workflow and useful date-scoped statistics.
- Complete dashboard widgets and quick actions.

**Exit criteria:** summaries are traceable to stored source data and date ranges are clear.

## Phase 6 — Backup, restore, PWA, reliability, accessibility

- Add Dexie schema for browser-local snapshots/drafts and versioned snapshot metadata.
- Snapshot no more than daily plus before destructive operations; retain seven by default.
- Add complete ZIP/JSON export and validated import/restore, including vision-board assets.
- Add task CSV and journal Markdown export.
- Add PWA manifest, cache application shell, offline indicator, and safe draft preservation.
- Add responsive/accessibility pass and e2e coverage for core journeys.
- Test all failure and empty states.

**Exit criteria:** export/restore round-trip tests pass; critical flows work on desktop and mobile; offline behavior is honest and understandable.

## Phase 7 — Production deployment and operational checklist

- Configure production Vercel environment variables.
- Apply reviewed Supabase migrations to the production project.
- Configure Supabase Auth redirect URLs and allowed site URLs.
- Configure private storage bucket policies.
- Configure Google OAuth consent screen, redirect URIs, and required scopes only if the integration will be enabled.
- Verify Vercel deployment, production auth, RLS, storage access, error reporting without personal content, and backup restore.
- Document free-tier limits, possible project pausing, local backup limitations, and manual recovery steps.

**Exit criteria:** production smoke tests pass and a fresh machine can reproduce the setup using the README.

## Later — Shared workspaces and collaboration

- Invite members to a workspace/project.
- Implement workspace roles and UI for membership management.
- Add comments and activity history.
- Enable Supabase Realtime selectively for shared records.
- Add conflict-aware collaboration UX.
- Add stronger automated backup/restore operational strategy before broader public launch.

Do not implement this later phase unless explicitly requested after the personal MVP is stable.
