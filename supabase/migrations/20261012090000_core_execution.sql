-- Phase 2: core execution — tags, projects, tasks (subtasks, dependencies, recurrence), ideas,
-- and connected yearly/monthly/weekly/daily plans.
--
-- Security model (same as Phase 1)
-- * RLS is enabled on every table here; members read, owner/admin/member write, viewers read.
-- * Every cross-table reference is a composite foreign key (id, workspace_id), so a row can only
--   ever point at rows in its own workspace, even if another workspace's UUID is guessed.
-- * Privileges start from nothing and are granted per table/column. `workspace_id` can never be
--   updated, so rows cannot be moved between workspaces.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.idea_status as enum ('inbox', 'developing', 'someday', 'archived');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.project_status as enum ('planned', 'active', 'on_hold', 'completed', 'archived');
create type public.recurrence_frequency as enum ('daily', 'weekly', 'monthly');
create type public.plan_period as enum ('year', 'month', 'week', 'day');

-- Composite foreign keys need a matching unique key on the referenced table.
alter table public.areas add constraint areas_id_workspace_key unique (id, workspace_id);

create function private.can_write_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_workspace_role(
    target_workspace, array['owner', 'admin', 'member']::public.workspace_role[]
  );
$$;

revoke all on function private.can_write_workspace(uuid) from public;
grant execute on function private.can_write_workspace(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default '#78716c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create unique index tags_workspace_name_unique on public.tags (workspace_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  area_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (char_length(description) <= 5000),
  notes text check (char_length(notes) <= 20000),
  status public.project_status not null default 'active',
  start_date date,
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (start_date is null or due_date is null or due_date >= start_date),
  foreign key (area_id, workspace_id) references public.areas (id, workspace_id)
    on delete set null (area_id)
);

create index projects_workspace_status_idx on public.projects (workspace_id, status, sort_order);
create index projects_area_idx on public.projects (area_id);
create index projects_name_trgm_idx on public.projects using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  description text check (char_length(description) <= 20000),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  -- Date-only deadline interpreted in the user's timezone; time is optional and needs a date.
  due_date date,
  due_time time,
  estimate_minutes integer check (estimate_minutes between 1 and 10080),
  project_id uuid,
  area_id uuid,
  -- One level of subtasks (enforced by trigger).
  parent_task_id uuid,
  sort_order integer not null default 0,
  completed_at timestamptz,
  -- Recurrence: the next occurrence is created when this one is completed.
  recurrence_frequency public.recurrence_frequency,
  recurrence_interval smallint not null default 1 check (recurrence_interval between 1 and 365),
  -- 0 = Sunday … 6 = Saturday; weekly only.
  recurrence_weekdays smallint[],
  recurrence_until date,
  -- Series anchor (maintained by trigger) so monthly dates don't drift after short months.
  recurrence_anchor date,
  -- Set on generated occurrences; unique so completing twice never creates two next tasks.
  recurs_from_task_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (due_time is null or due_date is not null),
  check (recurrence_frequency is null or due_date is not null),
  check (
    recurrence_weekdays is null
    or (
      recurrence_frequency = 'weekly'
      and cardinality(recurrence_weekdays) between 1 and 7
      and recurrence_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  ),
  check (recurrence_until is null or recurrence_frequency is not null),
  check (parent_task_id is null or parent_task_id <> id),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id)
    on delete set null (project_id),
  foreign key (area_id, workspace_id) references public.areas (id, workspace_id)
    on delete set null (area_id),
  -- Deleting a task deletes its subtasks; the UI confirms this with the subtask count.
  foreign key (parent_task_id, workspace_id) references public.tasks (id, workspace_id)
    on delete cascade,
  foreign key (recurs_from_task_id) references public.tasks (id) on delete set null
);

create index tasks_workspace_status_due_idx on public.tasks (workspace_id, status, due_date);
create index tasks_workspace_due_idx on public.tasks (workspace_id, due_date)
  where status in ('todo', 'in_progress');
create index tasks_project_idx on public.tasks (project_id);
create index tasks_area_idx on public.tasks (area_id);
create index tasks_parent_idx on public.tasks (parent_task_id);
create index tasks_title_trgm_idx on public.tasks using gin (title extensions.gin_trgm_ops);

create table public.task_tags (
  task_id uuid not null,
  tag_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, tag_id),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade,
  foreign key (tag_id, workspace_id) references public.tags (id, workspace_id) on delete cascade
);

create index task_tags_tag_idx on public.task_tags (tag_id);
create index task_tags_workspace_idx on public.task_tags (workspace_id);

-- `task_id` cannot be completed until `depends_on_task_id` is done or cancelled.
create table public.task_dependencies (
  task_id uuid not null,
  depends_on_task_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade,
  foreign key (depends_on_task_id, workspace_id) references public.tasks (id, workspace_id)
    on delete cascade
);

create index task_dependencies_depends_on_idx on public.task_dependencies (depends_on_task_id);
create index task_dependencies_workspace_idx on public.task_dependencies (workspace_id);

-- ---------------------------------------------------------------------------
-- Ideas (brainstorming inbox)
-- ---------------------------------------------------------------------------

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  body text check (char_length(body) <= 20000),
  status public.idea_status not null default 'inbox',
  -- The work an idea became. The idea itself is kept so its original content is never lost.
  converted_task_id uuid,
  converted_project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (converted_task_id, workspace_id) references public.tasks (id, workspace_id)
    on delete set null (converted_task_id),
  foreign key (converted_project_id, workspace_id) references public.projects (id, workspace_id)
    on delete set null (converted_project_id)
);

create index ideas_workspace_status_idx on public.ideas (workspace_id, status, created_at desc);
create index ideas_title_trgm_idx on public.ideas using gin (title extensions.gin_trgm_ops);
create index ideas_converted_task_idx on public.ideas (converted_task_id);
create index ideas_converted_project_idx on public.ideas (converted_project_id);

create table public.idea_tags (
  idea_id uuid not null,
  tag_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, tag_id),
  foreign key (idea_id, workspace_id) references public.ideas (id, workspace_id) on delete cascade,
  foreign key (tag_id, workspace_id) references public.tags (id, workspace_id) on delete cascade
);

create index idea_tags_tag_idx on public.idea_tags (tag_id);
create index idea_tags_workspace_idx on public.idea_tags (workspace_id);

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------

-- Plans hold what the user writes (theme, focus, reflection). Task lists and progress are derived
-- from linked records, never copied into the plan.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period public.plan_period not null,
  -- Date-only. Weeks start on the creator's configured week-start day.
  period_start date not null,
  parent_plan_id uuid,
  theme text check (char_length(theme) <= 200),
  focus text check (char_length(focus) <= 5000),
  reflection text check (char_length(reflection) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, period, period_start),
  check (
    case period
      when 'year' then extract(month from period_start) = 1 and extract(day from period_start) = 1
      when 'month' then extract(day from period_start) = 1
      else true
    end
  ),
  check (parent_plan_id is null or parent_plan_id <> id),
  foreign key (parent_plan_id, workspace_id) references public.plans (id, workspace_id)
    on delete set null (parent_plan_id)
);

create index plans_parent_idx on public.plans (parent_plan_id);
create index plans_workspace_period_idx on public.plans (workspace_id, period, period_start);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  plan_id uuid not null,
  task_id uuid,
  project_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (num_nonnulls(task_id, project_id) = 1),
  unique (plan_id, task_id),
  unique (plan_id, project_id),
  foreign key (plan_id, workspace_id) references public.plans (id, workspace_id) on delete cascade,
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade,
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id)
    on delete cascade
);

create index plan_items_plan_idx on public.plan_items (plan_id, sort_order);
create index plan_items_task_idx on public.plan_items (task_id);
create index plan_items_project_idx on public.plan_items (project_id);
create index plan_items_workspace_idx on public.plan_items (workspace_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger tags_set_updated_at before update on public.tags
  for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function private.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();
create trigger ideas_set_updated_at before update on public.ideas
  for each row execute function private.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Task rules
-- ---------------------------------------------------------------------------

-- Next due date of a recurring series after `current_due`, or null if the rule cannot produce one.
create function private.next_occurrence(
  frequency public.recurrence_frequency,
  every smallint,
  weekdays smallint[],
  anchor date,
  current_due date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  candidate date;
  anchor_week_start date;
  n integer;
begin
  if frequency is null or current_due is null then
    return null;
  end if;
  anchor := coalesce(anchor, current_due);

  if frequency = 'daily' then
    return current_due + every;
  end if;

  if frequency = 'weekly' then
    if weekdays is null then
      return current_due + 7 * every;
    end if;
    -- Weeks are counted from the Monday of the anchor's ISO week; only every `every`-th week
    -- is active.
    anchor_week_start := anchor - (extract(isodow from anchor)::integer - 1);
    for offset_days in 1 .. (7 * every + 7) loop
      candidate := current_due + offset_days;
      if extract(dow from candidate)::smallint = any (weekdays)
        and ((candidate - anchor_week_start) / 7) % every = 0 then
        return candidate;
      end if;
    end loop;
    return null;
  end if;

  -- Monthly: same day of month as the anchor, clamped to shorter months (Jan 31 -> Feb 28/29),
  -- and computed from the anchor so later months return to the 31st.
  for n in 1 .. 1200 loop
    candidate := (anchor + make_interval(months => n * every))::date;
    if candidate > current_due then
      return candidate;
    end if;
  end loop;
  return null;
end;
$$;

create function private.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_parent uuid;
begin
  -- completed_at follows status; it cannot be set directly.
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status is distinct from 'done' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;

  -- Recurrence anchor: reset whenever the rule or the due date is edited.
  if new.recurrence_frequency is null then
    new.recurrence_anchor := null;
    new.recurrence_weekdays := null;
    new.recurrence_until := null;
  elsif tg_op = 'INSERT' then
    new.recurrence_anchor := coalesce(new.recurrence_anchor, new.due_date);
  elsif old.recurrence_frequency is distinct from new.recurrence_frequency
    or old.recurrence_interval is distinct from new.recurrence_interval
    or old.recurrence_weekdays is distinct from new.recurrence_weekdays
    or old.due_date is distinct from new.due_date then
    new.recurrence_anchor := new.due_date;
  end if;

  -- One level of subtasks: a subtask cannot have subtasks of its own.
  if new.parent_task_id is not null then
    select t.parent_task_id into parent_parent from public.tasks t where t.id = new.parent_task_id;
    if parent_parent is not null then
      raise exception 'SUBTASK_DEPTH: a subtask cannot have its own subtasks'
        using errcode = 'P0001';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.tasks c where c.parent_task_id = new.id)
    then
      raise exception 'SUBTASK_DEPTH: a task with subtasks cannot become a subtask'
        using errcode = 'P0001';
    end if;
  end if;

  -- A task cannot be completed while a task it depends on is unfinished.
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    if exists (
      select 1
      from public.task_dependencies d
      join public.tasks blocker on blocker.id = d.depends_on_task_id
      where d.task_id = new.id
        and blocker.status not in ('done', 'cancelled')
    ) then
      raise exception 'TASK_BLOCKED: finish or cancel the tasks this one depends on first'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- Creates the next occurrence when a recurring task is completed. Security definer so it can set
-- the internal series columns; it only copies the row that the caller was already allowed to
-- update, into the same workspace.
create function private.tasks_create_next_occurrence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_due date;
  next_id uuid;
begin
  if new.status <> 'done' or old.status = 'done' or new.recurrence_frequency is null then
    return null;
  end if;

  next_due := private.next_occurrence(
    new.recurrence_frequency,
    new.recurrence_interval,
    new.recurrence_weekdays,
    new.recurrence_anchor,
    new.due_date
  );
  if next_due is null or (new.recurrence_until is not null and next_due > new.recurrence_until)
  then
    return null;
  end if;

  insert into public.tasks (
    workspace_id, title, description, priority, due_date, due_time, estimate_minutes,
    project_id, area_id, parent_task_id, sort_order,
    recurrence_frequency, recurrence_interval, recurrence_weekdays, recurrence_until,
    recurrence_anchor, recurs_from_task_id
  )
  values (
    new.workspace_id, new.title, new.description, new.priority, next_due, new.due_time,
    new.estimate_minutes, new.project_id, new.area_id, new.parent_task_id, new.sort_order,
    new.recurrence_frequency, new.recurrence_interval, new.recurrence_weekdays,
    new.recurrence_until, new.recurrence_anchor, new.id
  )
  on conflict (recurs_from_task_id) do nothing
  returning id into next_id;

  if next_id is not null then
    insert into public.task_tags (task_id, tag_id, workspace_id)
    select next_id, tt.tag_id, tt.workspace_id from public.task_tags tt where tt.task_id = new.id;
  end if;

  return null;
end;
$$;

revoke all on function private.tasks_create_next_occurrence() from public;

create trigger tasks_create_next_occurrence
  after update of status on public.tasks
  for each row execute function private.tasks_create_next_occurrence();

-- Rejects dependency cycles (A depends on B depends on … A).
create function private.task_dependencies_prevent_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    with recursive chain(task_id) as (
      select new.depends_on_task_id
      union
      select d.depends_on_task_id
      from public.task_dependencies d
      join chain c on d.task_id = c.task_id
    )
    select 1 from chain where task_id = new.task_id
  ) then
    raise exception 'DEPENDENCY_CYCLE: this dependency would create a cycle'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_prevent_cycle
  before insert or update on public.task_dependencies
  for each row execute function private.task_dependencies_prevent_cycle();

-- ---------------------------------------------------------------------------
-- Plan rules
-- ---------------------------------------------------------------------------

create function private.plan_period_end(period public.plan_period, period_start date)
returns date
language sql
immutable
set search_path = ''
as $$
  -- Exclusive end of the period.
  select case period
    when 'year' then (period_start + interval '1 year')::date
    when 'month' then (period_start + interval '1 month')::date
    when 'week' then period_start + 7
    else period_start + 1
  end;
$$;

-- A parent must be exactly one level up (day -> week -> month -> year) and contain the child's
-- start date.
create function private.plans_check_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.plans;
  expected public.plan_period;
begin
  if new.parent_plan_id is null then
    return new;
  end if;
  select * into parent from public.plans p where p.id = new.parent_plan_id;
  expected := case new.period
    when 'day' then 'week'::public.plan_period
    when 'week' then 'month'::public.plan_period
    when 'month' then 'year'::public.plan_period
  end;
  if expected is null or parent.period <> expected then
    raise exception 'PLAN_PARENT_LEVEL: a % plan can only belong to a % plan',
      new.period, coalesce(expected::text, 'no')
      using errcode = 'P0001';
  end if;
  if new.period_start < parent.period_start
    or new.period_start >= private.plan_period_end(parent.period, parent.period_start) then
    raise exception 'PLAN_PARENT_RANGE: the parent plan does not contain this period'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger plans_check_parent
  before insert or update on public.plans
  for each row execute function private.plans_check_parent();

-- ---------------------------------------------------------------------------
-- Idea conversion (atomic, idempotent, runs with the caller's permissions)
-- ---------------------------------------------------------------------------

create function public.convert_idea_to_task(idea_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  idea public.ideas;
  new_task_id uuid;
begin
  select * into idea from public.ideas i where i.id = idea_id for update;
  if not found then
    raise exception 'IDEA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if idea.converted_task_id is not null then
    return idea.converted_task_id;
  end if;

  insert into public.tasks (workspace_id, title, description)
  values (idea.workspace_id, idea.title, idea.body)
  returning id into new_task_id;

  insert into public.task_tags (task_id, tag_id, workspace_id)
  select new_task_id, it.tag_id, it.workspace_id from public.idea_tags it where it.idea_id = idea.id;

  update public.ideas
  set converted_task_id = new_task_id, status = 'archived'
  where id = idea.id;

  return new_task_id;
end;
$$;

create function public.convert_idea_to_project(idea_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  idea public.ideas;
  new_project_id uuid;
begin
  select * into idea from public.ideas i where i.id = idea_id for update;
  if not found then
    raise exception 'IDEA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if idea.converted_project_id is not null then
    return idea.converted_project_id;
  end if;

  insert into public.projects (workspace_id, name, description)
  values (idea.workspace_id, left(idea.title, 200), idea.body)
  returning id into new_project_id;

  update public.ideas
  set converted_project_id = new_project_id, status = 'archived'
  where id = idea.id;

  return new_project_id;
end;
$$;

revoke all on function public.convert_idea_to_task(uuid) from public, anon;
revoke all on function public.convert_idea_to_project(uuid) from public, anon;
grant execute on function public.convert_idea_to_task(uuid) to authenticated;
grant execute on function public.convert_idea_to_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tag assignment (atomic; creates missing tags by name, case-insensitively)
-- ---------------------------------------------------------------------------

create function private.ensure_tags(target_workspace uuid, tag_names text[])
returns setof uuid
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(tag_names) > 20 then
    raise exception 'TOO_MANY_TAGS: use at most 20 tags' using errcode = 'P0001';
  end if;

  insert into public.tags (workspace_id, name)
  select distinct on (lower(btrim(n))) target_workspace, btrim(n)
  from unnest(tag_names) as n
  where btrim(n) <> ''
  on conflict (workspace_id, (lower(btrim(name)))) do nothing;

  return query
  select t.id
  from public.tags t
  where t.workspace_id = target_workspace
    and lower(btrim(t.name)) in (select lower(btrim(n)) from unnest(tag_names) as n);
end;
$$;

grant execute on function private.ensure_tags(uuid, text[]) to authenticated;

create function public.set_task_tags(target_task_id uuid, tag_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_workspace uuid;
  wanted uuid[];
begin
  select t.workspace_id into target_workspace from public.tasks t where t.id = target_task_id;
  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0002';
  end if;
  wanted := array(select private.ensure_tags(target_workspace, coalesce(tag_names, '{}')));

  delete from public.task_tags tt
  where tt.task_id = target_task_id and tt.tag_id <> all (wanted);
  insert into public.task_tags (task_id, tag_id, workspace_id)
  select target_task_id, tag_id, target_workspace from unnest(wanted) as tag_id
  on conflict do nothing;
end;
$$;

create function public.set_idea_tags(target_idea_id uuid, tag_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_workspace uuid;
  wanted uuid[];
begin
  select i.workspace_id into target_workspace from public.ideas i where i.id = target_idea_id;
  if not found then
    raise exception 'IDEA_NOT_FOUND' using errcode = 'P0002';
  end if;
  wanted := array(select private.ensure_tags(target_workspace, coalesce(tag_names, '{}')));

  delete from public.idea_tags it
  where it.idea_id = target_idea_id and it.tag_id <> all (wanted);
  insert into public.idea_tags (idea_id, tag_id, workspace_id)
  select target_idea_id, tag_id, target_workspace from unnest(wanted) as tag_id
  on conflict do nothing;
end;
$$;

revoke all on function public.set_task_tags(uuid, text[]) from public, anon;
revoke all on function public.set_idea_tags(uuid, text[]) from public, anon;
grant execute on function public.set_task_tags(uuid, text[]) to authenticated;
grant execute on function public.set_idea_tags(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table
  public.tags, public.projects, public.tasks, public.task_tags, public.task_dependencies,
  public.ideas, public.idea_tags, public.plans, public.plan_items
  from anon, authenticated;

grant select, delete on table
  public.tags, public.projects, public.tasks, public.task_tags, public.task_dependencies,
  public.ideas, public.idea_tags, public.plans, public.plan_items
  to authenticated;

grant insert (workspace_id, name, color) on public.tags to authenticated;
grant update (name, color) on public.tags to authenticated;

grant insert (
  workspace_id, area_id, name, description, notes, status, start_date, due_date, sort_order
) on public.projects to authenticated;
grant update (
  area_id, name, description, notes, status, start_date, due_date, sort_order
) on public.projects to authenticated;

-- completed_at, recurrence_anchor, and recurs_from_task_id are managed by triggers only.
grant insert (
  workspace_id, title, description, status, priority, due_date, due_time, estimate_minutes,
  project_id, area_id, parent_task_id, sort_order, recurrence_frequency, recurrence_interval,
  recurrence_weekdays, recurrence_until
) on public.tasks to authenticated;
grant update (
  title, description, status, priority, due_date, due_time, estimate_minutes, project_id,
  area_id, parent_task_id, sort_order, recurrence_frequency, recurrence_interval,
  recurrence_weekdays, recurrence_until
) on public.tasks to authenticated;

grant insert (task_id, tag_id, workspace_id) on public.task_tags to authenticated;
grant insert (task_id, depends_on_task_id, workspace_id) on public.task_dependencies
  to authenticated;

grant insert (workspace_id, title, body, status) on public.ideas to authenticated;
grant update (title, body, status, converted_task_id, converted_project_id) on public.ideas
  to authenticated;
grant insert (idea_id, tag_id, workspace_id) on public.idea_tags to authenticated;

grant insert (workspace_id, period, period_start, parent_plan_id, theme, focus, reflection)
  on public.plans to authenticated;
grant update (parent_plan_id, theme, focus, reflection) on public.plans to authenticated;

grant insert (workspace_id, plan_id, task_id, project_id, sort_order) on public.plan_items
  to authenticated;
grant update (sort_order) on public.plan_items to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: identical rules for every workspace-scoped table in this phase.
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tags', 'projects', 'tasks', 'task_tags', 'task_dependencies',
    'ideas', 'idea_tags', 'plans', 'plan_items'
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
