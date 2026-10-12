# Proposed Project Structure

This is the intended structure, not a claim that all files already exist. Claude Code should create it incrementally as phases are completed.

```text
personal-productivity-os/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── sign-up/
│   │   ├── forgot-password/
│   │   └── auth/callback/
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── inbox/
│   │   ├── today/
│   │   ├── planner/
│   │   ├── tasks/
│   │   ├── projects/
│   │   ├── habits/
│   │   ├── goals/
│   │   ├── vision-board/
│   │   ├── notes/
│   │   ├── journal/
│   │   ├── reviews/
│   │   └── settings/
│   ├── api/
│   │   └── integrations/google-calendar/
│   │       └── callback/        # OAuth redirect; connect/sync/disconnect are server actions
│   ├── globals.css
│   ├── layout.tsx
│   ├── manifest.ts
│   └── page.tsx
├── components/
│   ├── ui/                     # Reusable accessible primitives
│   ├── layout/                 # Sidebar, mobile navigation, app shell
│   ├── dashboard/
│   ├── tasks/
│   ├── planner/
│   ├── calendar/
│   ├── habits/
│   ├── goals/
│   ├── journal/
│   └── shared/
├── features/                   # Feature-specific schemas, hooks, services
│   ├── auth/
│   ├── inbox/
│   ├── planning/
│   ├── tasks/
│   ├── projects/
│   ├── habits/
│   ├── goals/
│   ├── notes/
│   ├── journal/
│   ├── focus/
│   ├── reviews/
│   ├── backups/
│   └── google-calendar/
├── lib/
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   └── middleware.ts        # Or version-appropriate proxy/session handler
│   ├── db/                     # Database types and typed data access helpers
│   ├── offline/                # Dexie snapshots/drafts, not a source of truth
│   ├── validation/             # Shared Zod schemas
│   ├── dates/                  # Timezone-safe date utilities
│   ├── auth/
│   └── utils.ts
├── hooks/
├── types/
│   └── database.ts              # Generated from Supabase schema
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql                 # Fake local/test data only
├── public/
│   ├── icons/
│   └── screenshots/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .gitignore
├── CLAUDE.md
├── IMPLEMENTATION_PLAN.md
├── PROJECT_STRUCTURE.md
├── README.md
├── REQUIREMENTS.md
├── package.json
├── postcss.config.mjs
├── eslint.config.mjs
├── tsconfig.json
└── vitest.config.ts
```

## Architecture conventions

- **`app/`** contains routes, layouts, and route handlers only; avoid putting all business logic directly into page files.
- **`components/`** contains reusable presentation components.
- **`features/`** contains feature-specific validation, domain logic, hooks, and services.
- **`lib/supabase/`** contains correctly separated server/browser clients.
- **`lib/db/`** contains typed persistence helpers. RLS remains the final authority for data access.
- **`lib/offline/`** contains only browser cache, drafts, and local snapshots.
- **`supabase/migrations/`** is the authoritative, version-controlled database schema history.
- **`tests/`** mirrors important behaviors and security boundaries.

Do not create every folder empty at project initialization. Add folders when their phase begins.
