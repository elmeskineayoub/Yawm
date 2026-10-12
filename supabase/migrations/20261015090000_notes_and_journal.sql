-- Phase 4 (part 2): text-first Notes and the dated Journal.
--
-- Security model (same as every earlier phase)
-- * RLS is enabled on every new table: members read; owner/admin/member write; viewers read-only;
--   signed-out callers get nothing.
-- * Every reference between rows is a composite (id, workspace_id) foreign key, so a row can only
--   point at rows in its own workspace, even with a guessed UUID.
-- * Column privileges are explicit: workspace_id can never change, and created_at/updated_at are
--   managed by triggers, never written by clients.
--
-- Privacy (REQUIREMENTS 6.11, 11): note and journal text is content the app must keep private. It
-- is stored only here, never sent to Google, analytics, or any AI/third-party service, and never
-- logged. There are no file attachments on notes or journal entries in v1.

-- ---------------------------------------------------------------------------
-- Notes: text-first records with optional links to a project, goal, or task.
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text check (char_length(body) <= 20000),
  -- Optional links. Deleting the linked record keeps the note (set null).
  project_id uuid,
  goal_id uuid,
  task_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id)
    on delete set null (project_id),
  foreign key (goal_id, workspace_id) references public.goals (id, workspace_id)
    on delete set null (goal_id),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id)
    on delete set null (task_id)
);

create index notes_workspace_updated_idx on public.notes (workspace_id, updated_at desc);
create index notes_title_trgm_idx on public.notes using gin (title extensions.gin_trgm_ops);
create index notes_project_idx on public.notes (project_id);
create index notes_goal_idx on public.notes (goal_id);
create index notes_task_idx on public.notes (task_id);

create table public.note_tags (
  note_id uuid not null,
  tag_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, tag_id),
  foreign key (note_id, workspace_id) references public.notes (id, workspace_id) on delete cascade,
  foreign key (tag_id, workspace_id) references public.tags (id, workspace_id) on delete cascade
);

create index note_tags_tag_idx on public.note_tags (tag_id);
create index note_tags_workspace_idx on public.note_tags (workspace_id);

-- ---------------------------------------------------------------------------
-- Journal: dated reflections. Several entries may share one date (REQUIREMENTS 6.11).
-- ---------------------------------------------------------------------------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Date-only value in the user's timezone: the day the entry is "about".
  entry_date date not null,
  title text check (char_length(btrim(title)) between 1 and 200),
  body text check (char_length(body) <= 20000),
  -- Optional 1–5 scales (1 = lowest). Null means "not recorded".
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  -- The reflection prompt the entry was started from, if any (a label, not analysed).
  prompt text check (char_length(prompt) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create index journal_entries_workspace_date_idx
  on public.journal_entries (workspace_id, entry_date desc, created_at desc);
create index journal_entries_title_trgm_idx
  on public.journal_entries using gin (title extensions.gin_trgm_ops);

create table public.journal_entry_tags (
  entry_id uuid not null,
  tag_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, tag_id),
  foreign key (entry_id, workspace_id) references public.journal_entries (id, workspace_id)
    on delete cascade,
  foreign key (tag_id, workspace_id) references public.tags (id, workspace_id) on delete cascade
);

create index journal_entry_tags_tag_idx on public.journal_entry_tags (tag_id);
create index journal_entry_tags_workspace_idx on public.journal_entry_tags (workspace_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger notes_set_updated_at before update on public.notes
  for each row execute function private.set_updated_at();
create trigger journal_entries_set_updated_at before update on public.journal_entries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tag helpers (caller's permissions, so RLS applies to every row they touch), mirroring
-- set_idea_tags / set_task_tags from the core-execution migration.
-- ---------------------------------------------------------------------------

create function public.set_note_tags(target_note_id uuid, tag_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_workspace uuid;
  wanted uuid[];
begin
  select n.workspace_id into target_workspace from public.notes n where n.id = target_note_id;
  if not found then
    raise exception 'NOTE_NOT_FOUND' using errcode = 'P0002';
  end if;
  wanted := array(select private.ensure_tags(target_workspace, coalesce(tag_names, '{}')));

  delete from public.note_tags nt
  where nt.note_id = target_note_id and nt.tag_id <> all (wanted);
  insert into public.note_tags (note_id, tag_id, workspace_id)
  select target_note_id, tag_id, target_workspace from unnest(wanted) as tag_id
  on conflict do nothing;
end;
$$;

create function public.set_journal_tags(target_entry_id uuid, tag_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_workspace uuid;
  wanted uuid[];
begin
  select j.workspace_id into target_workspace
  from public.journal_entries j where j.id = target_entry_id;
  if not found then
    raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0002';
  end if;
  wanted := array(select private.ensure_tags(target_workspace, coalesce(tag_names, '{}')));

  delete from public.journal_entry_tags jt
  where jt.entry_id = target_entry_id and jt.tag_id <> all (wanted);
  insert into public.journal_entry_tags (entry_id, tag_id, workspace_id)
  select target_entry_id, tag_id, target_workspace from unnest(wanted) as tag_id
  on conflict do nothing;
end;
$$;

revoke all on function public.set_note_tags(uuid, text[]) from public, anon;
revoke all on function public.set_journal_tags(uuid, text[]) from public, anon;
grant execute on function public.set_note_tags(uuid, text[]) to authenticated;
grant execute on function public.set_journal_tags(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table
  public.notes, public.note_tags, public.journal_entries, public.journal_entry_tags
  from anon, authenticated;

grant select, delete on table
  public.notes, public.note_tags, public.journal_entries, public.journal_entry_tags
  to authenticated;

grant insert (workspace_id, title, body, project_id, goal_id, task_id, archived_at)
  on public.notes to authenticated;
grant update (title, body, project_id, goal_id, task_id, archived_at)
  on public.notes to authenticated;
grant insert (note_id, tag_id, workspace_id) on public.note_tags to authenticated;

grant insert (workspace_id, entry_date, title, body, mood, energy, prompt)
  on public.journal_entries to authenticated;
grant update (entry_date, title, body, mood, energy, prompt)
  on public.journal_entries to authenticated;
grant insert (entry_id, tag_id, workspace_id) on public.journal_entry_tags to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: the same rules as every workspace-scoped table.
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'notes', 'note_tags', 'journal_entries', 'journal_entry_tags'
  ] loop
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
