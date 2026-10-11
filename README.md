# Personal Productivity OS

A planning and self-management app for tasks, connected yearly-to-daily plans, projects, habits, goals, a vision board, brainstorming, notes, journaling, time blocking, focus sessions, and weekly reviews.

This repository is being implemented phase-by-phase from `IMPLEMENTATION_PLAN.md`. It is **not yet a working productivity application**.

## Current status

| Phase                                   | Status                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundation                          | Done: Next.js 16 App Router, TypeScript strict, Tailwind v4, ESLint, Prettier, Vitest, GitHub Actions CI, app shell, light/dark/system theme, `/api/health` |
| 1 — Supabase auth & workspace isolation | Not started                                                                                                                              |
| 2+                                      | Not started                                                                                                                              |

What exists today:

- Responsive app shell: collapsible desktop sidebar, mobile navigation drawer, skip link. Modules that are not implemented yet are shown as disabled ("Soon"), not linked.
- `/dashboard` placeholder and `/settings` with a theme selector (stored in this browser only via `next-themes`).
- A visible warning when Supabase public settings are missing or still the `.env.example` placeholders. Nothing is persisted anywhere yet.
- `GET /api/health` returns `{"status":"ok"}` only — no configuration, version, or database details.

Known limitations / notes:

- No authentication, database, or persistence yet (Phase 1+).
- `NEXT_PUBLIC_*` values are inlined at build time; rebuild/restart after changing `.env.local`.
- `npm audit` reports high-severity advisories in `braces`/`micromatch`/`fast-glob` pulled in by `eslint-config-next` (lint-time dev dependency only, not shipped to the browser). The only automated "fix" downgrades to Next 14 lint config, so it is left until upstream updates.
- Dependencies for later phases (FullCalendar, Dexie, googleapis, etc.) are declared in `package.json` but unused until their phase.
- Playwright e2e tests are not written yet (`npm run test:e2e` has no suite).

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

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 (redirects to `/dashboard`). Fill in the Supabase URL and publishable key in `.env.local` when you reach Phase 1; until then the app shows a "Supabase is not configured" notice. Do not commit `.env.local`.

Run quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

Unit tests live in `tests/unit/` (Vitest + jsdom + Testing Library, config in `vitest.config.mts`).

## Supabase setup checklist

1. Create a Supabase project.
2. Copy its project URL and publishable key into `.env.local`.
3. Configure Auth site URL and local/production redirect URLs.
4. Apply schema changes only through committed `supabase/migrations/` files.
5. Review RLS for every workspace-scoped table before adding real data.
6. Create a private Storage bucket and policies for vision-board images.
7. Test with two accounts to verify isolation.

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
