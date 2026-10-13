-- Phase 5 (part 2): in-app reminders.
--
-- Reminders are *derived* from data that already exists (due tasks, habits due today, upcoming time
-- blocks) and are only shown while the app is open (REQUIREMENTS 6.13 — no closed-browser
-- promises). This migration stores only two things the derivation needs:
--   * reminder_dismissals: which derived reminders the user has dismissed, keyed by a stable string
--     so the same reminder never reappears on refresh;
--   * reminder_preferences: per-workspace on/off switches for each reminder category.
--
-- Security model is identical to every earlier phase: RLS on both tables; members read;
-- owner/admin/member write; viewers read-only; signed-out callers get nothing; workspace_id can
-- never change.

create table public.reminder_dismissals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Stable key for a derived reminder, e.g. 'task:<uuid>' or 'habit:<uuid>:2026-10-12'.
  reminder_key text not null check (char_length(reminder_key) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (workspace_id, reminder_key)
);

create index reminder_dismissals_workspace_idx on public.reminder_dismissals (workspace_id);

create table public.reminder_preferences (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  show_tasks boolean not null default true,
  show_habits boolean not null default true,
  show_time_blocks boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reminder_preferences_set_updated_at before update on public.reminder_preferences
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.reminder_dismissals, public.reminder_preferences
  from anon, authenticated;

grant select, delete on table public.reminder_dismissals to authenticated;
grant insert (workspace_id, reminder_key) on public.reminder_dismissals to authenticated;

grant select on table public.reminder_preferences to authenticated;
grant insert (workspace_id, show_tasks, show_habits, show_time_blocks)
  on public.reminder_preferences to authenticated;
grant update (show_tasks, show_habits, show_time_blocks)
  on public.reminder_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: the same rules as every workspace-scoped table.
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array['reminder_dismissals', 'reminder_preferences'] loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using ((select private.is_workspace_member(workspace_id)))',
      table_name || ': members read', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check ((select private.can_write_workspace(workspace_id)))',
      table_name || ': writers insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using ((select private.can_write_workspace(workspace_id))) '
      'with check ((select private.can_write_workspace(workspace_id)))',
      table_name || ': writers update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using ((select private.can_write_workspace(workspace_id)))',
      table_name || ': writers delete', table_name
    );
  end loop;
end;
$$;
