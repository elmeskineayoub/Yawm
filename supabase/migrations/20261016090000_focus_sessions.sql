-- Phase 5 (part 1): the focus timer's completed-session history.
--
-- Security model (same as every earlier phase)
-- * RLS is enabled on the new table: members read; owner/admin/member write; viewers read-only;
--   signed-out callers get nothing.
-- * The optional task link is a composite (id, workspace_id) foreign key, so a session can only
--   point at a task in its own workspace.
-- * Column privileges are explicit: workspace_id can never change, and created_at/updated_at are
--   trigger-managed.
--
-- The running timer itself lives only in the browser (recovered from timestamps after a reload);
-- this table stores sessions once they finish, so daily/weekly focus totals are derived from real
-- rows. The row's own id is supplied by the client and is unique, so logging the same finished
-- session twice (e.g. after a reload) is a no-op rather than a duplicate.

create type public.focus_session_type as enum ('focus', 'short_break', 'long_break');

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid,
  session_type public.focus_session_type not null default 'focus',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- Actual elapsed seconds (may be less than the planned length if stopped early).
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (ended_at >= started_at),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id)
    on delete set null (task_id)
);

create index focus_sessions_workspace_started_idx
  on public.focus_sessions (workspace_id, started_at desc);
create index focus_sessions_task_idx on public.focus_sessions (task_id);

create trigger focus_sessions_set_updated_at before update on public.focus_sessions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.focus_sessions from anon, authenticated;
grant select, delete on table public.focus_sessions to authenticated;
-- `id` is client-supplied so that re-logging a finished session is idempotent (it hits the
-- primary key instead of inserting a duplicate), so it must be insertable.
grant insert (id, workspace_id, task_id, session_type, started_at, ended_at, duration_seconds)
  on public.focus_sessions to authenticated;
-- Sessions are immutable once written; there is no update grant.

-- ---------------------------------------------------------------------------
-- Row Level Security: the same rules as every workspace-scoped table.
-- ---------------------------------------------------------------------------

alter table public.focus_sessions enable row level security;

create policy "focus_sessions: members read" on public.focus_sessions
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "focus_sessions: writers insert" on public.focus_sessions
  for insert to authenticated
  with check ((select private.can_write_workspace(workspace_id)));
create policy "focus_sessions: writers delete" on public.focus_sessions
  for delete to authenticated
  using ((select private.can_write_workspace(workspace_id)));
