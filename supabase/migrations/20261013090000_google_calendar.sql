-- Phase 3 (part 2): optional Google Calendar connection and one-way sync of app time blocks.
--
-- Why a migration is needed: the app needs somewhere to keep the encrypted OAuth tokens and a
-- per-block record of the Google event it created. `time_blocks.external_event_id` cannot be
-- reused for app blocks (it identifies blocks imported from Google, and a check constraint keeps
-- it null for app blocks), and Google events shown in the Planner are read live, not stored.
--
-- Security model
-- * A connection belongs to one user in one workspace (v1: at most one per workspace). Only that
--   user can see or change it, and only while they can write in the workspace. Other members,
--   viewers, and signed-out callers see nothing.
-- * Tokens are stored only as AES-256-GCM ciphertext produced on the server with
--   GOOGLE_TOKEN_ENCRYPTION_KEY, which never reaches the database or the browser. The app never
--   selects these columns for pages or sends them to the client.
-- * Sync rows are visible to the connection's owner only, for the same reason.
-- * Deleting a time block keeps its sync row with time_block_id = null, so the server can still
--   delete the Google event afterwards. Disconnecting deletes the connection and its sync rows.

create type public.google_connection_status as enum ('active', 'reconnect_required', 'error');
create type public.calendar_sync_status as enum ('pending', 'synced', 'error');

create table public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  google_account_email text check (char_length(google_account_email) <= 320),
  refresh_token_ciphertext text not null check (char_length(refresh_token_ciphertext) <= 4096),
  access_token_ciphertext text check (char_length(access_token_ciphertext) <= 8192),
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  -- The one calendar app blocks are written to, and the calendars whose events are shown.
  target_calendar_id text check (char_length(target_calendar_id) <= 1024),
  target_calendar_name text check (char_length(target_calendar_name) <= 300),
  read_calendar_ids text[] not null default '{}' check (cardinality(read_calendar_ids) <= 20),
  status public.google_connection_status not null default 'active',
  -- A short, user-facing reason. Never contains tokens or event content.
  last_error text check (char_length(last_error) <= 500),
  last_synced_at timestamptz,
  -- Back-off after Google rate-limits us; automatic retries wait until then.
  retry_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id),
  unique (id, workspace_id),
  -- Losing workspace membership removes the connection (and its tokens).
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id)
    on delete cascade
);

create index google_calendar_connections_user_idx on public.google_calendar_connections (user_id);

create trigger google_calendar_connections_set_updated_at
  before update on public.google_calendar_connections
  for each row execute function private.set_updated_at();

revoke all on table public.google_calendar_connections from anon, authenticated;
grant select, delete on table public.google_calendar_connections to authenticated;
grant insert (
  workspace_id, user_id, google_account_email, refresh_token_ciphertext, access_token_ciphertext,
  access_token_expires_at, scopes, target_calendar_id, target_calendar_name, read_calendar_ids,
  status, last_error, last_synced_at, retry_after
) on public.google_calendar_connections to authenticated;
-- workspace_id and user_id can never change.
grant update (
  google_account_email, refresh_token_ciphertext, access_token_ciphertext,
  access_token_expires_at, scopes, target_calendar_id, target_calendar_name, read_calendar_ids,
  status, last_error, last_synced_at, retry_after
) on public.google_calendar_connections to authenticated;

alter table public.google_calendar_connections enable row level security;

create policy "google connections: owner reads" on public.google_calendar_connections
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.can_write_workspace(workspace_id)));

create policy "google connections: owner inserts" on public.google_calendar_connections
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.can_write_workspace(workspace_id)));

create policy "google connections: owner updates" on public.google_calendar_connections
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.can_write_workspace(workspace_id)))
  with check (user_id = (select auth.uid()) and (select private.can_write_workspace(workspace_id)));

create policy "google connections: owner deletes" on public.google_calendar_connections
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.can_write_workspace(workspace_id)));

-- ---------------------------------------------------------------------------
-- One row per synced block: which Google event represents it, and whether it is up to date.
-- ---------------------------------------------------------------------------

create table public.time_block_sync (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  connection_id uuid not null,
  -- Null once the block is deleted: the Google event still has to be removed.
  time_block_id uuid,
  calendar_id text not null check (char_length(calendar_id) <= 1024),
  -- Derived from the block ID, so a retried insert can never create a second event.
  event_id text not null
    check (event_id ~ '^[a-v0-9]+$' and char_length(event_id) between 5 and 1024),
  status public.calendar_sync_status not null default 'pending',
  last_error text check (char_length(last_error) <= 500),
  -- The block's updated_at when it was last pushed; a newer block means a push is due.
  block_updated_at timestamptz,
  synced_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (time_block_id),
  unique (connection_id, calendar_id, event_id),
  foreign key (connection_id, workspace_id)
    references public.google_calendar_connections (id, workspace_id) on delete cascade,
  foreign key (time_block_id, workspace_id) references public.time_blocks (id, workspace_id)
    on delete set null (time_block_id)
);

create index time_block_sync_workspace_idx on public.time_block_sync (workspace_id);
create index time_block_sync_pending_idx on public.time_block_sync (connection_id, status);
create index time_block_sync_orphans_idx on public.time_block_sync (connection_id)
  where time_block_id is null;

create trigger time_block_sync_set_updated_at before update on public.time_block_sync
  for each row execute function private.set_updated_at();

revoke all on table public.time_block_sync from anon, authenticated;
grant select, delete on table public.time_block_sync to authenticated;
grant insert (
  workspace_id, connection_id, time_block_id, calendar_id, event_id, status, last_error,
  block_updated_at, synced_at, attempts
) on public.time_block_sync to authenticated;
grant update (calendar_id, status, last_error, block_updated_at, synced_at, attempts)
  on public.time_block_sync to authenticated;

alter table public.time_block_sync enable row level security;

create function private.owns_google_connection(target_connection uuid, target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.google_calendar_connections c
    where c.id = target_connection
      and c.workspace_id = target_workspace
      and c.user_id = (select auth.uid())
  ) and private.can_write_workspace(target_workspace);
$$;

revoke all on function private.owns_google_connection(uuid, uuid) from public, anon;
grant execute on function private.owns_google_connection(uuid, uuid) to authenticated;

create policy "time_block_sync: connection owner reads" on public.time_block_sync
  for select to authenticated
  using ((select private.owns_google_connection(connection_id, workspace_id)));

create policy "time_block_sync: connection owner inserts" on public.time_block_sync
  for insert to authenticated
  with check ((select private.owns_google_connection(connection_id, workspace_id)));

create policy "time_block_sync: connection owner updates" on public.time_block_sync
  for update to authenticated
  using ((select private.owns_google_connection(connection_id, workspace_id)))
  with check ((select private.owns_google_connection(connection_id, workspace_id)));

create policy "time_block_sync: connection owner deletes" on public.time_block_sync
  for delete to authenticated
  using ((select private.owns_google_connection(connection_id, workspace_id)));
