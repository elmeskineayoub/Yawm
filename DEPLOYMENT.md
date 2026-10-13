# Production deployment & operations

This is the Phase 7 runbook: how to deploy Yawm to production, verify it, and operate it. It
assumes Phases 0–6 are merged to `main` and CI is green. The companion `README.md` covers local
development; this file is the production checklist.

Hosting target: **Vercel Hobby + Supabase Free** (personal, non-commercial). Review both providers'
current limits before any public or commercial use — see "Operational notes".

---

## 0. Prerequisites

- A **Supabase** account and a new project (note its project ref and database password).
- A **Vercel** account connected to the GitHub repo.
- The **Supabase CLI** (installed as a dev dependency: `npx supabase …`).
- Optional: a **Google Cloud** project if you will enable Google Calendar.
- Your production domain (e.g. `https://your-app.vercel.app`).

Decide your values up front:

| Name                                   | Where it comes from                            |
| -------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Your production origin, e.g. the Vercel domain |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys         |
| Google `*` (optional)                  | Google Cloud OAuth client + `openssl rand`     |

Never put the Supabase **secret/service-role** key, the Google client secret, or
`GOOGLE_TOKEN_ENCRYPTION_KEY` in any `NEXT_PUBLIC_*` variable, client code, or Git.

---

## 1. Apply the database schema to the hosted project

Migrations are **never** applied automatically (not by CI, not by the app). Apply them explicitly,
in order, once per environment.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run   # lists pending migrations; changes nothing
npx supabase db push             # applies them, each in its own transaction
```

This creates every table with **RLS enabled in the same migration**, the private `vision-board`
Storage bucket and its policies, and the functions (including `import_workspace`). No dashboard-only
schema changes — the repository is the source of truth.

If the project already has data, **back up first** (see "Operational notes → Backups") and read the
per-migration notes in `README.md` ("Applying a new migration to a hosted project").

### Network note

If `db push` fails to connect with `ECONNREFUSED` over an IPv6/NAT64 address, use the IPv4 **Session
pooler** connection string (port 5432) from Supabase → Project Settings → Database:

```bash
npx supabase db push --db-url "postgresql://postgres.YOUR_REF:YOUR_DB_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

Do not paste that string into Git or chat — it contains the database password.

---

## 2. Configure Supabase Auth

In the Supabase dashboard:

1. **Authentication → URL Configuration**
   - _Site URL_: your production origin (e.g. `https://your-app.vercel.app`).
   - _Redirect URLs_: add `https://your-app.vercel.app/**` (and `http://localhost:3000/**` for local).
2. **Authentication → Sign In / Providers → Email**: keep _Confirm email_ enabled; set minimum
   password length to 8.
3. **Authentication → Emails → Templates**: replace _Confirm signup_ and _Reset password_ with
   `supabase/templates/confirmation.html` and `recovery.html` (they link to `/auth/callback` so
   links work on any device).
4. **Custom SMTP**: the built-in sender is heavily rate-limited and for testing only. Configure your
   own SMTP before real use.

Storage: the private `vision-board` bucket and its policies are created by the Phase 4 migration —
nothing to set up in the dashboard. **Do not make the bucket public.**

---

## 3. Deploy to Vercel

1. Import the GitHub repo into Vercel (framework preset: Next.js).
2. **Project Settings → Environment Variables** (Production, and Preview if you use it):
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Google (only if enabling): `GOOGLE_CALENDAR_INTEGRATION_ENABLED=true`, `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_ENCRYPTION_KEY`.
3. Deploy. `NEXT_PUBLIC_*` values are inlined at build time, so **redeploy after changing them**.
4. Return to step 2 (Supabase Auth) and make sure the Site/Redirect URLs match the real domain.

Security response headers (HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`) are set for every route in `next.config.ts`. The app also
serves `/robots.txt` disallowing indexing (it is private).

---

## 4. Google Calendar (optional)

Only if `GOOGLE_CALENDAR_INTEGRATION_ENABLED=true` and every `GOOGLE_*` value is set. See
`README.md` → "Google Calendar (optional)" for the Cloud Console steps (enable Calendar API,
consent screen, the two narrow scopes, and a Web OAuth client whose redirect URI is
`https://YOUR_DOMAIN/api/integrations/google-calendar/callback`). The app works fully with the
integration off; Settings explains what is missing.

---

## 5. Production smoke tests

Run these against the deployed site after the first deploy and after any schema change. All should
pass; none should expose another user's data.

- [ ] **Auth**: sign up a new account → receive the confirmation email → confirm → land on the
      dashboard. Sign out and back in. Run a password reset end to end.
- [ ] **Workspace isolation**: sign up a **second** account. Confirm it cannot see or load the first
      account's tasks/notes/journal (direct URLs to the other account's record ids 404 / show
      nothing). This is the RLS guarantee; `npm run test:integration` proves it in CI.
- [ ] **Persistence**: create a task, a note, and a journal entry. Reload, sign out/in — they
      persist. Autosave shows "Saving… / Saved" only after the server confirms.
- [ ] **Storage**: add a vision-board image; confirm it displays via a signed URL and is not
      reachable through a public URL.
- [ ] **Backup round-trip**: Settings → Data & backup → download the JSON. Re-upload it, preview the
      counts, and run a **merge** (safe). Confirm no errors. (The browser e2e covers this in CI.)
- [ ] **Focus timer**: start a focus session, reload the tab mid-session — the countdown recovers.
- [ ] **Reminders / offline**: the bell shows due items; toggling the browser offline shows the
      offline indicator.
- [ ] **Google (if enabled)**: connect, pick a calendar, confirm events appear read-only and a time
      block syncs once (no duplicates); disconnect revokes tokens.
- [ ] **No personal content in logs**: check Vercel/Supabase logs contain no task/note/journal
      bodies. The app never logs content or sends it to analytics/AI.
- [ ] **Headers**: `curl -sI https://YOUR_DOMAIN` shows the security headers; `/robots.txt`
      disallows indexing.

A fresh machine should be able to reproduce the whole setup from this file plus `README.md`.

---

## 6. Operational notes

- **Free-tier limits & pausing**: Supabase Free projects can be **paused after ~a week of
  inactivity** and do **not** include managed daily backups you can self-restore. Vercel Hobby is
  for non-commercial use within its limits. Re-check both before public launch or monetization.
- **Backups (your responsibility on Free)**:
  - Before any migration or risky change to a project with real data, dump it and keep the files
    **outside** the repo (they contain personal data):
    ```bash
    npx supabase db dump --linked -f backup-schema.sql
    npx supabase db dump --linked --data-only -f backup-data.sql
    ```
  - Use the in-app **full JSON export** regularly, and test **restore** (Settings → Data & backup)
    before relying on it. Browser-local snapshots are best-effort and lost if site data is cleared.
- **Future migrations**: `git pull`, review the new `supabase/migrations/*.sql`, back up, then
  `npx supabase db push`. Deploy the matching app version after the migration succeeds.
- **Rollback**: redeploy the previous Vercel build. Schema changes have no automatic down-migration;
  restore from your backup or write a new migration that drops the added objects (see `README.md`
  per-migration notes for exactly what each one added).
- **Rotating `GOOGLE_TOKEN_ENCRYPTION_KEY`** invalidates stored Google tokens; every user then sees
  "Reconnect Google Calendar". Keep it stable and secret.

---

## 7. Known gaps before a public launch

These are intentionally deferred and should be closed before exposing Yawm beyond personal use:

- **Account & workspace deletion** flows (data export already exists; deletion does not).
- **Global search** across all entities (per-module search exists today).
- Service-worker shell caching and bundling vision-board image binaries into the backup.
- Shared workspaces / collaboration (the schema is ready; no UI yet).
