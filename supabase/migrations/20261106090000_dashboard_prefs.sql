-- Dashboard section show/hide (REQUIREMENTS 6.1: "widget customization can be basic in v1 (show/hide
-- and sensible ordering)"; UX redesign Stage 3.3).
--
-- A per-user UI preference on the user's own profile row, so it follows them across devices. Read
-- and write access comes from the existing "profiles: read own" / "profiles: update own" RLS
-- policies. profiles uses column-level update grants, so authenticated users are granted update on
-- this one new column only, like display_name, timezone, and week_start.
--
-- Shape (validated by the app): { "hidden": ["week", "reflect", ...] }. The check keeps it a small
-- JSON object so the column cannot be used as general-purpose storage.

alter table public.profiles
  add column dashboard_prefs jsonb not null default '{}'::jsonb
  constraint profiles_dashboard_prefs_shape check (
    jsonb_typeof(dashboard_prefs) = 'object' and pg_column_size(dashboard_prefs) <= 2048
  );

grant update (dashboard_prefs) on table public.profiles to authenticated;
