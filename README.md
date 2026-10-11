# Personal Productivity OS

A planning and self-management app for tasks, connected yearly-to-daily plans, projects, habits, goals, a vision board, brainstorming, notes, journaling, time blocking, focus sessions, and weekly reviews.

This repository is being implemented phase-by-phase from `IMPLEMENTATION_PLAN.md`. It is **not yet a working productivity application**.

## Current status

| Phase                                   | Status                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundation                          | Done: Next.js 16 App Router, TypeScript strict, Tailwind v4, ESLint, Prettier, Vitest, GitHub Actions CI, app shell, light/dark/system theme, `/api/health` |
| 1 — Supabase auth & workspace isolation | Done: email/password auth with verification and reset, protected routes, personal workspace + default areas, RLS with integration tests                     |
| 2+                                      | Not started                                                                                                                                                 |

What exists today:

- **Accounts:** sign up (with email verification), sign in, sign out, forgot/reset password. Unverified accounts cannot sign in.
- **Protected app:** every route except the auth pages, `/auth/*`, and `/api/health` requires a session. `proxy.ts` refreshes the Supabase session and redirects; each protected page re-checks on the server.
- **Workspace bootstrap:** on signup the database creates a profile (with the browser's IANA timezone), a private "Personal" workspace, an owner membership, and the editable default areas Spiritual, Mental, Physical, Finances. Editing areas arrives in Phase 2.
- **Dashboard and Settings** read the workspace, areas, and profile from Supabase. Settings also has the light/dark/system theme (stored in this browser only).
- **Safe disabled state:** without Supabase settings the app shows a setup notice instead of forms or data. Nothing pretends to save.
- `GET /api/health` returns `{"status":"ok"}` only.

### Security model (Phase 1)

Schema: `supabase/migrations/20261011230000_identity_and_workspaces.sql`.

| Table               | Read                           | Write from the browser/API                                 |
| ------------------- | ------------------------------ | ---------------------------------------------------------- |
| `profiles`          | own row                        | update own `display_name`, `timezone`, `week_start`        |
| `workspaces`        | workspaces you are a member of | owner/admin may rename                                     |
| `workspace_members` | members of your workspaces     | none (bootstrap trigger only)                              |
| `areas`             | your workspaces                | owner/admin/member insert/update/delete; viewers read-only |

- RLS is enabled on every table, and table/column privileges are granted explicitly, so for example an area cannot be moved to another workspace and nobody can change their own role.
- Membership checks are `security definer` functions in a non-exposed `private` schema.
- `anon` (signed-out) has no privileges on these tables.
- The app uses only the publishable key. No service-role/secret key is used by the app; the integration tests use the local stack's secret key to create test users.

Known limitations / notes:

- Workspace creation, switching, and membership management (invites) are intentionally not exposed yet; the schema supports multiple workspaces and roles for the collaboration phase.
- Profile editing (name, timezone, week start) has no UI yet; Settings shows the values. The database already validates them.
- Account and workspace deletion flows are not built (required before public release). Deleting a user in Supabase removes their personal workspace via cascades.
- `NEXT_PUBLIC_*` values are inlined at build time; rebuild/restart after changing `.env.local`.
- `npm audit` reports high-severity advisories in `braces`/`micromatch`/`fast-glob` pulled in by `eslint-config-next` (lint-time dev dependency only, not shipped to the browser). The only automated "fix" downgrades to Next 14 lint config, so it is left until upstream updates.
- Dependencies for later phases (FullCalendar, Dexie, googleapis, etc.) are declared in `package.json` but unused until their phase.

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
   npx supabase db push
   ```
3. **Authentication → URL Configuration:** set _Site URL_ to your app origin (e.g. `https://your-app.vercel.app`) and add `http://localhost:3000/**` and `https://your-app.vercel.app/**` to _Redirect URLs_.
4. **Authentication → Sign In / Providers → Email:** keep _Confirm email_ enabled, and set the minimum password length to 8.
5. **Authentication → Emails → Templates:** replace the _Confirm signup_ and _Reset password_ templates with `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`. They link to `/auth/callback` with a token hash, so links work even when opened on another device. (With the default templates, links work only in the browser that started the flow.)
6. Hosted Supabase's built-in email sender is heavily rate-limited and intended for testing; configure custom SMTP before real use.
7. Copy the project URL and **publishable** key (Project Settings → API Keys) into `.env.local` or Vercel environment variables as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and set `NEXT_PUBLIC_APP_URL`. Never put the secret/service-role key in this app's environment.
8. Sign up with two accounts and confirm neither can see the other's data. The automated version of this check is `npm run test:integration`.

Still to come in later phases: a private Storage bucket and policies for vision-board images (Phase 4).

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
