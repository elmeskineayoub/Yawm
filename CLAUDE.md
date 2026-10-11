# Claude Code Instructions

Read `REQUIREMENTS.md`, `PROJECT_STRUCTURE.md`, and `IMPLEMENTATION_PLAN.md` before changing code. `REQUIREMENTS.md` is the product source of truth. If an implementation shortcut conflicts with its privacy, RLS, backup, or date-handling requirements, follow the requirements and explain the trade-off.

## How to work

1. Inspect the existing repository before editing. Do not overwrite existing user work without understanding it.
2. Work in the implementation phases in `IMPLEMENTATION_PLAN.md`. Do not try to implement the entire product in one large pass.
3. Begin each phase by summarizing the files and database migrations that will be added, then implement that phase completely.
4. After each logical unit, run the applicable lint, typecheck, unit/integration tests, and production build. Fix failures before moving on.
5. If a required Supabase or Google credential is absent, build a clear setup guide and a safe disabled state; never fake successful persistence or calendar sync.
6. Keep changes small and reviewable. Avoid speculative abstractions and unnecessary dependencies.
7. Do not claim a feature works unless it is implemented and tested. Record incomplete work and limitations in the README.

## Non-negotiable technical rules

- TypeScript strict mode. Avoid `any`; if unavoidable, explain why and narrow it as early as possible.
- Use Next.js App Router conventions appropriate to the installed Next.js version.
- Follow the current official Supabase SSR pattern. Separate browser and server Supabase clients correctly; handle cookies/session refresh as required by the installed version.
- The Supabase PostgreSQL database is the canonical source of truth. Dexie/IndexedDB is only a local snapshot/cache/draft layer, never an undisclosed competing source of truth.
- All workspace-scoped tables require RLS. Add SQL migrations to Git and test that one user cannot read or modify another user's records.
- Never place a Supabase service-role key, Google client secret, refresh token, or token-encryption key in client components, public environment variables, browser storage, logs, or Git.
- All authorization decisions must be enforced by the database/server, not only by hiding UI controls.
- Use private Supabase Storage buckets for vision-board images and verify access policies.
- Treat date-only values (due dates, habit log dates, planning period starts) differently from UTC instants. Respect the user's IANA timezone.
- For calendar sync, persist provider event IDs and implement idempotency to prevent duplicate events. External events are read-only in v1; app time blocks sync one-way to Google Calendar.
- Autosave and async mutations must show honest state: saving, saved after server confirmation, offline draft/pending, or error.
- Validate imported JSON/ZIP data before writing it. Never overwrite the workspace silently.
- Do not send journal, note, idea, habit, or task content to third-party analytics or AI services.
- No dedicated Islamic routines are needed; custom habits/tasks/time blocks must cover the user's use cases.
- Do not add a command palette. Global search and quick capture are required.

## UI standards

- Use a restrained Todoist-inspired task interface without copying its branding/assets.
- Use reusable components, accessible forms, loading/empty/error states, keyboard support, and responsive layouts.
- English only for v1. Support light/dark/system theme.
- Avoid overbuilding charts; dashboards must emphasize actions and readable summaries.

## Database workflow

- Create and review migrations before application code depends on new tables or columns.
- Do not rely on manual dashboard-only schema changes.
- Enable RLS and create policies in the same migration as a new workspace-scoped table.
- Add indexes for workspace IDs, foreign keys, common date filters, schedule ranges, and search.
- Generate/update database TypeScript types after schema changes.
- Write seed data only for local/test development; never put real personal data in repository fixtures.

## Testing workflow

Prioritize tests for: RLS isolation, date/timezone boundaries, recurring task behavior, habit streaks and rest days, plan hierarchy, backup/restore round trips, focus timer recovery, and Google Calendar idempotency. Mock external Google API calls in automated tests. Keep a small browser end-to-end suite for the main user journeys.

## Required completion report

At the end of every phase, report:

- What was implemented.
- Important files/migrations changed.
- Commands/tests run and their actual results.
- Manual setup still required.
- Known limitations or deferred items.
- The exact next phase recommended.
