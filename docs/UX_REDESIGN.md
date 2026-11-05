# Yawm UX Redesign — Audit and Plan

**Status:** Stages 1–3 complete (audit, foundation, core experience: task panel and rows, Today, Dashboard, Planner, Tasks, Projects), 2026-11-05. Stage 4 (Habits, Goals & Vision, Inbox, Notes, Journal, Reviews) next. Carry-over: wrap the remaining server-action calls on not-yet-redesigned screens in safeAction (lib/safe-action.ts) as each is redesigned.
**Scope:** UI/UX only. The backend, schema, RLS, and data access stay as they are unless a step
below says otherwise. `REQUIREMENTS.md` remains the product source of truth; where this document
and the requirements disagree, the requirements win.

**Baseline before the redesign** (commit `9e71028`): ESLint passes, typecheck passes, 200/200
unit tests pass (28 files), `next build` succeeds, `npm audit` reports zero vulnerabilities.

---

## 1. Route map

| Area           | Routes                                                                                                                          | Notes                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Shell          | `app/(app)/layout.tsx` → `AppShell`                                                                                             | Loads reminders; sidebar, mobile drawer, offline banner     |
| Dashboard      | `/dashboard`                                                                                                                    | 4 count tiles and 11 equal-weight cards                     |
| Inbox          | `/inbox?status&q&tag&page`, `/inbox/[id]`                                                                                       | Paginated, 50 per page                                      |
| Today          | `/today`                                                                                                                        | Stacked sections, list-only                                 |
| Planner        | `/planner?view=day\|week\|month\|year&start=`                                                                                   | FullCalendar, block side panel, carry-forward, Google sync  |
| Tasks          | `/tasks?view=list\|board&…filters`, `/tasks/[id]`                                                                               | Filters live in the URL (GET form)                          |
| Projects       | `/projects`, `/projects/[id]`                                                                                                   |                                                             |
| Habits         | `/habits`, `/habits?archived=1`, `/habits/[id]`                                                                                 | Heatmap only on the detail page                             |
| Goals & Vision | `/goals`, `/goals?status=archived`, `/goals/[id]`, `/goals/vision`                                                              | Two tabs                                                    |
| Notes          | `/notes`, `/notes/[id]`                                                                                                         | Explicit "Save changes"                                     |
| Journal        | `/journal`, `/journal/[id]`                                                                                                     | Autosave                                                    |
| Reviews        | `/reviews`                                                                                                                      | Weekly                                                      |
| Focus          | `/focus`                                                                                                                        | Not in the navigation; reachable only from a Dashboard link |
| Settings       | `/settings`                                                                                                                     | One long page                                               |
| Auth / infra   | `/login`, `/sign-up`, `/forgot-password`, `/reset-password`, `/auth/*`, `/setup`, `/api/export`, `/api/health`, Google callback | Out of scope except for tokens                              |

## 2. Feature map

The data layer is complete and tested for every requirement area: tasks (recurrence, subtasks,
dependencies, tags), linked year → month → week → day plans, time blocks with one-way Google
sync, habits (boolean/measurable, streaks, rest days), goals and milestones, the vision board
(private storage), notes, journal, focus sessions, reminders, weekly review, and backup/restore.

Two required features are missing from the UI and are part of this redesign:

- **Global search** (REQUIREMENTS §9). Only per-module search exists today.
- **Dashboard section show/hide** (REQUIREMENTS §6.1). No storage exists for it.

## 3. UX problems, highest impact first

1. **Dashboard and Today duplicate each other.** Both show priorities, scheduled blocks, habits,
   and due/overdue tasks. Neither answers its own question well.
2. **Today has no timeline, focus timer, reschedule action, or journal entry point.** Scheduling
   means leaving for the Planner.
3. **Every task edit is a full page**: a long form with "Save changes" plus six stacked cards.
4. **Task filters are eight selects and an "Apply" button.** Today/Upcoming/Overdue/Completed
   exist only as options in the "Due" dropdown. The board has no drag-and-drop.
5. **Shell:** `<main>` is capped at `max-w-5xl` on every route, which squeezes the Planner. The
   navigation is 12 flat items. On mobile, quick capture is inside the hamburger drawer and
   there is no bottom navigation. The collapsed sidebar state resets on reload.
6. **The accent colour equals the text colour.** Links, active navigation, primary buttons, and
   progress bars all look alike. Semantic colours are raw Tailwind classes; priority is barely
   visible.
7. **Inconsistent components:** four separately built segmented controls, two capture
   components, duplicate `TextField`/`InputField`, the `rounded-lg border bg-surface p-5` box
   copied into 9 files, and detail pages that build their own headers.
8. **The Inbox is noisy:** every row shows a status select, three Convert buttons, and Delete.
9. **Notes need an explicit save while Journal autosaves.**
10. **The Area → Goal → Project → Task chain** is visible only on the goal detail page.
11. **The weekly review stops at numbers.** It cannot carry work forward or set next week's
    priorities.
12. **No undo** after completing or archiving, and no per-route loading skeletons.

**Keep:** honest save states (`SaveStatus`, `InlineEdit`), confirmations only for deletes, the
right-side sheet used by `block-panel` and `card-panel`, the Planner's keyboard shortcuts,
accessible labels, and the clear separation of deadlines from scheduled blocks.

## 4. Information architecture

```
[ + Capture (q) ]  [ Search (/) ]
Dashboard
EXECUTE    Today · Inbox · Tasks · Planner
ORGANISE   Projects · Goals & Vision · Habits
REFLECT    Notes · Journal · Reviews
[● Focus 18:42]   (shown only while a timer runs)
Settings · Account (theme, sign out)
```

- **Mobile:** a bottom bar with Today, Planner, ＋ Capture, Inbox, and More (a sheet with the
  rest). Search sits in the top bar.
- **Task details** open in a side sheet (`?task=<id>`) from any route; `/tasks/[id]` stays as
  the deep link.
- **Focus** lives in Today (compact timer) and a sidebar chip while running; `/focus` remains
  the full view. No 13th navigation item.
- **Dashboard** answers "what is happening across my life?"; **Today** answers "what do I do
  now?". They do not repeat each other's lists.

## 5. Visual language: editorial minimalism

A calm personal workspace, closer to a refined journal than a SaaS dashboard.

- **Structure from type and whitespace, not boxes.** Sections are separated by spacing and
  hairline dividers. Cards are reserved for discrete visual objects (vision-board items).
  Shadows only on floating layers (sheet, popover, dialog, toast).
- **Typography:** Newsreader (serif, optical sizing) for page titles, date headlines,
  journal/notes writing, and review prompts. Inter for all interface text and data, with
  tabular numbers. Plus Jakarta Sans is dropped (the logo is an image and is unaffected).
  - Page title: serif 30/36, weight 500
  - Section label: Inter 11–12px, semibold, letter-spaced, muted
  - List row: Inter 14/20 · Metadata: Inter 12px
  - Writing: serif 17/28, about 68-character measure
- **Colour:** one accent; everything else is warm neutral.

  | Token                   | Light                 | Dark             |
  | ----------------------- | --------------------- | ---------------- |
  | background              | `#F7F5F0`             | `#1A1A18`        |
  | surface                 | `#FCFBF8`             | `#22221F`        |
  | surface-muted           | `#EFECE5`             | `#2B2A27`        |
  | border                  | `#E4E0D7`             | `#34332F`        |
  | foreground              | `#23221F`             | `#EBE8E1`        |
  | muted-foreground        | `#6B675F`             | `#A19D94`        |
  | accent (forest sage)    | `#3D5A47`             | `#8FAE96`        |
  | accent-soft             | `#E3E9E2`             | `#2C3A30`        |
  | danger / warning / info | brick / ochre / slate | lighter variants |

  Priorities reuse these: urgent = danger, high = warning, medium = accent, low = neutral.
  Every text/background pair must meet WCAG AA.

- **Density:** 4px spacing step; list rows 36px desktop / 44px touch; whitespace goes into page
  margins and section gaps (32–40px), not inside lists.
- **Details:** Lucide icons at 16px with a thinner stroke in the muted colour; 6px radius on
  controls, 8px on panels; 150ms motion on sheets/popovers only, disabled for reduced motion.
- **Editorial touches with a job:** a serif date headline and one plain sentence computed from
  the user's data on Today and Dashboard (no AI); journal and notes open as a page to write on;
  the weekly review reads as a short summary.

## 6. Reuse

| Reuse or extract                | Source                                                            |
| ------------------------------- | ----------------------------------------------------------------- |
| `Sheet` primitive               | Radix right-sheet in `block-panel.tsx` / `card-panel.tsx`         |
| Auto-saving fields              | `InlineEdit`, `SaveStatus` (extend to selects and dates)          |
| Notes autosave                  | Debounce/blur/visibility logic in `journal-editor.tsx`            |
| Today timeline                  | `PlannerCalendar` in day mode                                     |
| Today focus timer               | `FocusTimer` (compact variant)                                    |
| Task quick views / filter chips | `parseTaskFilters` / `taskFiltersToSearch`                        |
| Planner drag-in                 | FullCalendar `Draggable` (`@fullcalendar/interaction`, installed) |
| Search rate limiting            | `lib/rate-limit.ts`                                               |

## 7. Implementation sequence

Each step is its own reviewable change. After each: lint, typecheck, unit and integration tests,
affected e2e specs, and a production build. Accessible names used by e2e tests stay stable.

### Stage 2 — Foundation

- **2a.** Tokens (palette, semantic and priority colours, radii, shadows, type) in
  `app/globals.css`; Newsreader + Inter in `app/layout.tsx`; theme colours in the viewport,
  manifest, and app icon; FullCalendar re-theme.
- **2b.** `components/ui/`: Button sizes/danger/icon variants; Badge on tokens; merge
  `TextField` into `FieldShell`; new `segmented-control`, `link-tabs`, `sheet`, `section`,
  `prose`, `skeleton`, `kbd`, `tooltip`, `menu`; `PageHeader` with actions/breadcrumb/meta slots.
- **2c.** Shell: `app-shell.tsx`, `sidebar-nav.tsx`, `lib/navigation.ts` (groups),
  `account-menu.tsx` (theme toggle); new `mobile-tab-bar.tsx`, `focus-chip.tsx`; per-route
  `PageContainer` widths; collapsed sidebar remembered in `localStorage` (per-device convenience).
- **2d.** Global search: `features/search/queries.ts`, `features/search/actions.ts`,
  `components/layout/global-search.tsx`. Tasks, projects, goals, ideas, notes, journal;
  workspace-scoped through RLS, rate-limited, debounced, grouped by type, keyboard navigable.
  Results and navigation only — not a command palette.
- **2e.** Quick capture as a single line with an Idea/Task toggle; still closes only after server
  confirmation.

### Stage 3 — Core experience

- **3.1** Task sheet (`features/tasks/detail.ts`, `components/tasks/task-sheet.tsx`) with
  auto-saving fields; task rows with priority-coloured checkbox, quick reschedule, undo after
  completing (non-recurring tasks only unless reopening is shown to clean up the generated
  next occurrence).
- **3.2** Today: execution list (intention, priorities, overdue with explicit reschedule, due
  today, habits, next 3 days) beside the day timeline, focus timer, and reflect link.
- **3.3** Dashboard: written summary, needs attention, this week, projects and goals progress,
  reflection prompt; show/hide sections.
- **3.4** Planner: full width; Year › Month › Week › Day breadcrumb; drag unscheduled tasks onto
  the calendar; deadline vs block legend.
- **3.5** Tasks: quick-view tabs, instant filter chips (GET form kept as fallback), task sheet,
  board drag-and-drop (status select kept for keyboard users).
- **3.6** Projects: compact rows; detail shows Area › Goal › Project, milestones, linked notes.

### Stage 4 — Personal development

Habits (checklist first, creation in a sheet), Goals & Vision (grouped by area, next
milestone), Inbox (short rows, one Convert menu, undo on archive), Notes (two-pane, autosave),
Journal (date navigator), Reviews ("Decide" step: carry forward, next week's priorities),
Settings (section sub-navigation).

### Stage 5 — Polish

Route skeletons, keyboard-shortcut help (`?`) and j/k list navigation, accessibility pass,
Playwright checks at 390px and 1440px including horizontal overflow, e2e updates, README update.

## 8. Decisions

| Decision                    | Choice                                                     | Reason                                                              |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Dashboard show/hide storage | Migration adding `profiles.dashboard_prefs jsonb`          | Syncs across devices; existing own-row RLS on `profiles` covers it  |
| New dependencies            | `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip` | Same family as installed Radix packages; correct keyboard behaviour |
| Serif typeface              | Newsreader                                                 | Optical sizing suits both titles and long-form writing              |
| Focus navigation            | No new nav item; timer in Today plus a running chip        | Keeps the 12-item IA from REQUIREMENTS §5                           |
