-- Phase 3: time blocks for the Planner calendar, and atomic "add a priority" helpers.
--
-- Security model (same as earlier phases)
-- * RLS is enabled here: members read; owner/admin/member write; viewers read-only.
-- * task/project links are composite (id, workspace_id) foreign keys, so a block can only point
--   at work in its own workspace.
-- * Clients may only create and change blocks that originate in the app. Blocks imported from an
--   external calendar (origin <> 'app') are read-only in v1; a future server-side sync job
--   will write them, with its own reviewed migration.
--
-- Times are UTC instants (timestamptz). `timezone` records the IANA zone the block was planned
-- in, for context; display always uses the viewer's profile timezone.

create type public.time_block_origin as enum ('app', 'google');

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (char_length(notes) <= 5000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null check (private.is_valid_timezone(timezone)),
  -- Scheduled work for a task. Independent of the task's due date (a deadline).
  task_id uuid,
  project_id uuid,
  origin public.time_block_origin not null default 'app',
  -- Reserved for calendar sync: the provider's calendar and event IDs (idempotency key).
  external_calendar_id text,
  external_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '24 hours'),
  check ((origin = 'app') = (external_event_id is null)),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id)
    on delete set null (task_id),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id)
    on delete set null (project_id)
);

-- Range queries ask for blocks with starts_at < range_end and ends_at > range_start.
create index time_blocks_workspace_starts_idx on public.time_blocks (workspace_id, starts_at);
create index time_blocks_workspace_ends_idx on public.time_blocks (workspace_id, ends_at);
create index time_blocks_task_idx on public.time_blocks (task_id);
create index time_blocks_project_idx on public.time_blocks (project_id);
create unique index time_blocks_external_event_unique
  on public.time_blocks (workspace_id, origin, external_calendar_id, external_event_id)
  where external_event_id is not null;

create trigger time_blocks_set_updated_at before update on public.time_blocks
  for each row execute function private.set_updated_at();

revoke all on table public.time_blocks from anon, authenticated;
grant select, delete on table public.time_blocks to authenticated;
-- origin and the external IDs are not client-writable: app blocks always default to 'app'.
grant insert (workspace_id, title, notes, starts_at, ends_at, timezone, task_id, project_id)
  on public.time_blocks to authenticated;
grant update (title, notes, starts_at, ends_at, timezone, task_id, project_id)
  on public.time_blocks to authenticated;

alter table public.time_blocks enable row level security;

create policy "time_blocks: members read" on public.time_blocks
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "time_blocks: writers insert app blocks" on public.time_blocks
  for insert to authenticated
  with check ((select private.can_write_workspace(workspace_id)) and origin = 'app');

create policy "time_blocks: writers update app blocks" on public.time_blocks
  for update to authenticated
  using ((select private.can_write_workspace(workspace_id)) and origin = 'app')
  with check ((select private.can_write_workspace(workspace_id)) and origin = 'app');

create policy "time_blocks: writers delete app blocks" on public.time_blocks
  for delete to authenticated
  using ((select private.can_write_workspace(workspace_id)) and origin = 'app');

-- ---------------------------------------------------------------------------
-- "Add a priority": create the task or project and link it to the plan in one transaction.
-- Runs with the caller's permissions, so RLS applies to every row it touches.
-- ---------------------------------------------------------------------------

create function public.add_task_to_plan(
  target_plan_id uuid,
  task_title text,
  task_due_date date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan public.plans;
  new_task_id uuid;
begin
  select * into plan from public.plans p where p.id = target_plan_id;
  if not found then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.tasks (workspace_id, title, due_date)
  values (plan.workspace_id, task_title, task_due_date)
  returning id into new_task_id;

  insert into public.plan_items (workspace_id, plan_id, task_id, sort_order)
  select plan.workspace_id, plan.id, new_task_id, coalesce(max(pi.sort_order), -1) + 1
  from public.plan_items pi
  where pi.plan_id = plan.id;

  return new_task_id;
end;
$$;

create function public.add_project_to_plan(target_plan_id uuid, project_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan public.plans;
  new_project_id uuid;
begin
  select * into plan from public.plans p where p.id = target_plan_id;
  if not found then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.projects (workspace_id, name)
  values (plan.workspace_id, project_name)
  returning id into new_project_id;

  insert into public.plan_items (workspace_id, plan_id, project_id, sort_order)
  select plan.workspace_id, plan.id, new_project_id, coalesce(max(pi.sort_order), -1) + 1
  from public.plan_items pi
  where pi.plan_id = plan.id;

  return new_project_id;
end;
$$;

revoke all on function public.add_task_to_plan(uuid, text, date) from public, anon;
revoke all on function public.add_project_to_plan(uuid, text) from public, anon;
grant execute on function public.add_task_to_plan(uuid, text, date) to authenticated;
grant execute on function public.add_project_to_plan(uuid, text) to authenticated;
