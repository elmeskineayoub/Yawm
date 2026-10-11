-- Phase 1: identity, workspaces, membership, and life areas.
--
-- Security model
-- * Every workspace-scoped table has RLS enabled in this migration.
-- * Access is granted only through membership rows in public.workspace_members.
-- * Clients cannot create, change, or delete memberships or workspaces yet. The personal
--   workspace is bootstrapped by a trigger on auth.users. Membership management arrives with
--   the collaboration phase, together with its own policies and tests.
-- * Helper functions live in the non-exposed `private` schema so PostgREST does not publish them.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Types and helpers
-- ---------------------------------------------------------------------------

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- IANA timezone names only (e.g. "Europe/London"); rejects POSIX offsets like "UTC+3".
create function private.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select tz is not null and exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 100),
  timezone text not null default 'UTC' check (private.is_valid_timezone(timezone)),
  -- 0 = Sunday … 6 = Saturday
  week_start smallint not null default 1 check (week_start between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  is_personal boolean not null default false,
  -- Deleting the creating account removes their personal workspace. Shared workspaces will need
  -- an ownership-transfer rule before account deletion is offered (collaboration phase).
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workspaces_one_personal_per_user
  on public.workspaces (created_by)
  where is_personal;

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  color text not null default '#78716c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index areas_workspace_sort_idx on public.areas (workspace_id, sort_order);
create unique index areas_active_name_unique
  on public.areas (workspace_id, lower(btrim(name)))
  where archived_at is null;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger areas_set_updated_at before update on public.areas
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership checks (security definer so policies don't recurse through workspace_members RLS)
-- ---------------------------------------------------------------------------

create function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
  );
$$;

create function private.has_workspace_role(
  target_workspace uuid,
  allowed_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role = any (allowed_roles)
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, public.workspace_role[]) from public;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[])
  to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, then grant only what policies are meant to allow.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles, public.workspaces, public.workspace_members, public.areas
  from anon, authenticated;

grant select on table public.profiles, public.workspaces, public.workspace_members, public.areas
  to authenticated;
grant update (display_name, timezone, week_start) on table public.profiles to authenticated;
grant update (name) on table public.workspaces to authenticated;
grant insert (workspace_id, name, color, sort_order, archived_at) on table public.areas
  to authenticated;
grant update (name, color, sort_order, archived_at) on table public.areas to authenticated;
grant delete on table public.areas to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.areas enable row level security;

-- profiles: a user sees and edits only their own profile. Rows are created by the signup trigger.
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- workspaces: members read; owners/admins rename.
create policy "workspaces: members read" on public.workspaces
  for select to authenticated
  using ((select private.is_workspace_member(id)));

create policy "workspaces: owners and admins update" on public.workspaces
  for update to authenticated
  using ((select private.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[])))
  with check (
    (select private.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]))
  );

-- workspace_members: members can see who else belongs to their workspaces. No client writes.
create policy "workspace_members: members read" on public.workspace_members
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

-- areas: members read; owner/admin/member write; viewers are read-only.
create policy "areas: members read" on public.areas
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "areas: writers insert" on public.areas
  for insert to authenticated
  with check (
    (select private.has_workspace_role(
      workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]
    ))
  );

create policy "areas: writers update" on public.areas
  for update to authenticated
  using (
    (select private.has_workspace_role(
      workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]
    ))
  )
  with check (
    (select private.has_workspace_role(
      workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]
    ))
  );

create policy "areas: writers delete" on public.areas
  for delete to authenticated
  using (
    (select private.has_workspace_role(
      workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]
    ))
  );

-- ---------------------------------------------------------------------------
-- Account bootstrap: profile, private personal workspace, owner membership, default areas.
-- Runs in the same transaction as the auth.users insert, so signup either fully succeeds or
-- fails as a whole.
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_timezone text := new.raw_user_meta_data ->> 'timezone';
  requested_name text := nullif(btrim(left(new.raw_user_meta_data ->> 'display_name', 100)), '');
  new_workspace_id uuid;
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    requested_name,
    case when private.is_valid_timezone(requested_timezone) then requested_timezone else 'UTC' end
  );

  insert into public.workspaces (name, is_personal, created_by)
  values ('Personal', true, new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.areas (workspace_id, name, color, sort_order)
  values
    (new_workspace_id, 'Spiritual', '#8b5cf6', 0),
    (new_workspace_id, 'Mental', '#0ea5e9', 1),
    (new_workspace_id, 'Physical', '#22c55e', 2),
    (new_workspace_id, 'Finances', '#f59e0b', 3);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
