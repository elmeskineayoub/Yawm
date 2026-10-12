-- Phase 4 (part 1): habits, goals and milestones, and the vision board.
--
-- Security model (same as earlier phases)
-- * RLS is enabled on every new table in this migration: members read; owner/admin/member
--   write; viewers read-only; signed-out callers get nothing.
-- * Every reference between rows is a composite (id, workspace_id) foreign key, so a row can
--   only point at rows in its own workspace.
-- * Column privileges are explicit: workspace_id can never change.
-- * Vision-board images live in a private Storage bucket. Object paths are
--   `{workspace_id}/{item_id}/{file}`; Storage policies check workspace membership on the first
--   folder and that the item exists in that workspace.
--
-- Derived values (streaks, completion rates, goal progress) are calculated in the app from these
-- rows and never stored. Habit log dates are date-only values in the user's timezone.

create type public.habit_kind as enum ('boolean', 'measurable');
create type public.habit_frequency as enum ('daily', 'weekly');
create type public.goal_status as enum ('active', 'paused', 'achieved', 'archived');

-- ---------------------------------------------------------------------------
-- Habits
-- ---------------------------------------------------------------------------

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  area_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 2000),
  kind public.habit_kind not null default 'boolean',
  -- Measurable habits: done for a day when the logged value reaches the target.
  target_value numeric(12, 2) check (target_value > 0),
  unit text check (char_length(btrim(unit)) between 1 and 30),
  -- daily: due on the listed ISO weekdays (1 = Monday … 7 = Sunday); other days are rest days.
  -- weekly: due `times_per_week` times in each week, on any days.
  frequency public.habit_frequency not null default 'daily',
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'),
  times_per_week smallint check (times_per_week between 1 and 7),
  -- The active period, as dates in the user's timezone.
  starts_on date not null,
  ends_on date,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check ((kind = 'measurable') = (target_value is not null)),
  check (kind = 'measurable' or unit is null),
  check ((frequency = 'weekly') = (times_per_week is not null)),
  check (ends_on is null or ends_on >= starts_on),
  foreign key (area_id, workspace_id) references public.areas (id, workspace_id)
    on delete set null (area_id)
);

create index habits_workspace_idx on public.habits (workspace_id, sort_order);
create index habits_area_idx on public.habits (area_id);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  habit_id uuid not null,
  log_date date not null,
  -- Boolean habits log 1. Measurable habits log the amount (0 is allowed: "tried, not met").
  value numeric(12, 2) check (value >= 0 and value <= 1000000),
  -- An explicit rest day: excused, never counted as a miss.
  rest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date),
  check ((rest and value is null) or (not rest and value is not null)),
  foreign key (habit_id, workspace_id) references public.habits (id, workspace_id)
    on delete cascade
);

create index habit_logs_habit_date_idx on public.habit_logs (habit_id, log_date);
create index habit_logs_workspace_date_idx on public.habit_logs (workspace_id, log_date);

-- ---------------------------------------------------------------------------
-- Goals and milestones
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  area_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 5000),
  why text check (char_length(why) <= 2000),
  status public.goal_status not null default 'active',
  start_date date,
  target_date date,
  -- Optional measurable target, e.g. "Read 24 books": current 7 / target 24 books.
  target_value numeric(14, 2) check (target_value > 0),
  current_value numeric(14, 2) check (current_value >= 0),
  unit text check (char_length(btrim(unit)) between 1 and 30),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (target_date is null or start_date is null or target_date >= start_date),
  check (target_value is not null or (current_value is null and unit is null)),
  foreign key (area_id, workspace_id) references public.areas (id, workspace_id)
    on delete set null (area_id)
);

create index goals_workspace_status_idx on public.goals (workspace_id, status, sort_order);
create index goals_area_idx on public.goals (area_id);
create index goals_title_trgm_idx on public.goals using gin (title extensions.gin_trgm_ops);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  goal_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (goal_id, workspace_id) references public.goals (id, workspace_id)
    on delete cascade
);

create index milestones_goal_idx on public.milestones (goal_id, sort_order);
create index milestones_workspace_due_idx on public.milestones (workspace_id, due_date);

-- Optional links from existing work to a goal. Deleting a goal keeps the work.
alter table public.projects add column goal_id uuid;
alter table public.projects
  add constraint projects_goal_fkey foreign key (goal_id, workspace_id)
  references public.goals (id, workspace_id) on delete set null (goal_id);
create index projects_goal_idx on public.projects (goal_id);

alter table public.tasks add column goal_id uuid;
alter table public.tasks
  add constraint tasks_goal_fkey foreign key (goal_id, workspace_id)
  references public.goals (id, workspace_id) on delete set null (goal_id);
create index tasks_goal_idx on public.tasks (goal_id);

-- Plans can link goals and milestones too (e.g. a year's major outcomes, a month's milestones).
alter table public.plan_items add column goal_id uuid;
alter table public.plan_items add column milestone_id uuid;
alter table public.plan_items drop constraint plan_items_check;
alter table public.plan_items
  add constraint plan_items_one_target_check
  check (num_nonnulls(task_id, project_id, goal_id, milestone_id) = 1);
alter table public.plan_items add constraint plan_items_plan_goal_key unique (plan_id, goal_id);
alter table public.plan_items
  add constraint plan_items_plan_milestone_key unique (plan_id, milestone_id);
alter table public.plan_items
  add constraint plan_items_goal_fkey foreign key (goal_id, workspace_id)
  references public.goals (id, workspace_id) on delete cascade;
alter table public.plan_items
  add constraint plan_items_milestone_fkey foreign key (milestone_id, workspace_id)
  references public.milestones (id, workspace_id) on delete cascade;
create index plan_items_goal_idx on public.plan_items (goal_id);
create index plan_items_milestone_idx on public.plan_items (milestone_id);

-- Ideas can become goals (REQUIREMENTS 6.2), like tasks and projects.
alter table public.ideas add column converted_goal_id uuid;
alter table public.ideas
  add constraint ideas_converted_goal_fkey foreign key (converted_goal_id, workspace_id)
  references public.goals (id, workspace_id) on delete set null (converted_goal_id);
create index ideas_converted_goal_idx on public.ideas (converted_goal_id);

-- ---------------------------------------------------------------------------
-- Vision board
-- ---------------------------------------------------------------------------

create table public.vision_board_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text check (char_length(btrim(title)) between 1 and 120),
  body text check (char_length(body) <= 1000),
  area_id uuid,
  goal_id uuid,
  -- Storage object path in the private `vision-board` bucket; must sit under this row's folder.
  image_path text check (char_length(image_path) <= 500),
  image_alt text check (char_length(image_alt) <= 300),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (num_nonnulls(title, body, image_path) >= 1),
  check (
    image_path is null
    or image_path like workspace_id::text || '/' || id::text || '/%'
  ),
  foreign key (area_id, workspace_id) references public.areas (id, workspace_id)
    on delete set null (area_id),
  foreign key (goal_id, workspace_id) references public.goals (id, workspace_id)
    on delete set null (goal_id)
);

create index vision_board_items_workspace_idx
  on public.vision_board_items (workspace_id, sort_order);
create index vision_board_items_area_idx on public.vision_board_items (area_id);
create index vision_board_items_goal_idx on public.vision_board_items (goal_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger habits_set_updated_at before update on public.habits
  for each row execute function private.set_updated_at();
create trigger habit_logs_set_updated_at before update on public.habit_logs
  for each row execute function private.set_updated_at();
create trigger goals_set_updated_at before update on public.goals
  for each row execute function private.set_updated_at();
create trigger milestones_set_updated_at before update on public.milestones
  for each row execute function private.set_updated_at();
create trigger vision_board_items_set_updated_at before update on public.vision_board_items
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recurring tasks keep their goal link in the next occurrence.
-- ---------------------------------------------------------------------------

create or replace function private.tasks_create_next_occurrence()
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
    project_id, area_id, goal_id, parent_task_id, sort_order,
    recurrence_frequency, recurrence_interval, recurrence_weekdays, recurrence_until,
    recurrence_anchor, recurs_from_task_id
  )
  values (
    new.workspace_id, new.title, new.description, new.priority, next_due, new.due_time,
    new.estimate_minutes, new.project_id, new.area_id, new.goal_id, new.parent_task_id,
    new.sort_order, new.recurrence_frequency, new.recurrence_interval, new.recurrence_weekdays,
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

-- ---------------------------------------------------------------------------
-- Functions (caller's permissions, so RLS applies to every row they touch)
-- ---------------------------------------------------------------------------

create function public.convert_idea_to_goal(idea_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  idea public.ideas;
  new_goal_id uuid;
begin
  select * into idea from public.ideas i where i.id = idea_id for update;
  if not found then
    raise exception 'IDEA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if idea.converted_goal_id is not null then
    return idea.converted_goal_id;
  end if;

  insert into public.goals (workspace_id, title, description)
  values (idea.workspace_id, left(idea.title, 200), left(idea.body, 5000))
  returning id into new_goal_id;

  update public.ideas
  set converted_goal_id = new_goal_id, status = 'archived'
  where id = idea.id;

  return new_goal_id;
end;
$$;

-- "Add an outcome" on a plan: create the goal and link it in one transaction.
create function public.add_goal_to_plan(target_plan_id uuid, goal_title text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan public.plans;
  new_goal_id uuid;
begin
  select * into plan from public.plans p where p.id = target_plan_id;
  if not found then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.goals (workspace_id, title)
  values (plan.workspace_id, goal_title)
  returning id into new_goal_id;

  insert into public.plan_items (workspace_id, plan_id, goal_id, sort_order)
  select plan.workspace_id, plan.id, new_goal_id, coalesce(max(pi.sort_order), -1) + 1
  from public.plan_items pi
  where pi.plan_id = plan.id;

  return new_goal_id;
end;
$$;

revoke all on function public.convert_idea_to_goal(uuid) from public, anon;
revoke all on function public.add_goal_to_plan(uuid, text) from public, anon;
grant execute on function public.convert_idea_to_goal(uuid) to authenticated;
grant execute on function public.add_goal_to_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table
  public.habits, public.habit_logs, public.goals, public.milestones, public.vision_board_items
  from anon, authenticated;

grant select, delete on table
  public.habits, public.habit_logs, public.goals, public.milestones, public.vision_board_items
  to authenticated;

grant insert (
  workspace_id, area_id, title, description, kind, target_value, unit, frequency, weekdays,
  times_per_week, starts_on, ends_on, sort_order, archived_at
) on public.habits to authenticated;
grant update (
  area_id, title, description, kind, target_value, unit, frequency, weekdays, times_per_week,
  starts_on, ends_on, sort_order, archived_at
) on public.habits to authenticated;

grant insert (workspace_id, habit_id, log_date, value, rest) on public.habit_logs
  to authenticated;
grant update (value, rest) on public.habit_logs to authenticated;

grant insert (
  workspace_id, area_id, title, description, why, status, start_date, target_date,
  target_value, current_value, unit, sort_order
) on public.goals to authenticated;
grant update (
  area_id, title, description, why, status, start_date, target_date, target_value,
  current_value, unit, sort_order
) on public.goals to authenticated;

grant insert (workspace_id, goal_id, title, due_date, completed_at, sort_order)
  on public.milestones to authenticated;
grant update (title, due_date, completed_at, sort_order) on public.milestones to authenticated;

grant insert (
  workspace_id, title, body, area_id, goal_id, image_path, image_alt, sort_order, archived_at
) on public.vision_board_items to authenticated;
grant update (title, body, area_id, goal_id, image_path, image_alt, sort_order, archived_at)
  on public.vision_board_items to authenticated;

-- New link columns on existing tables.
grant insert (goal_id) on public.projects to authenticated;
grant update (goal_id) on public.projects to authenticated;
grant insert (goal_id) on public.tasks to authenticated;
grant update (goal_id) on public.tasks to authenticated;
grant insert (goal_id, milestone_id) on public.plan_items to authenticated;
grant update (converted_goal_id) on public.ideas to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: the same rules as every workspace-scoped table.
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'habits', 'habit_logs', 'goals', 'milestones', 'vision_board_items'
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

-- ---------------------------------------------------------------------------
-- Private Storage bucket for vision-board images
-- ---------------------------------------------------------------------------

-- Private, 5 MB, raster images only (SVG can carry scripts, so it is not accepted).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vision-board', 'vision-board', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The workspace an object path belongs to, or null if the path isn't `{uuid}/{uuid}/{file}`.
create function private.vision_object_workspace(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

-- Writers may write an object only under an existing card of their workspace.
create function private.can_write_vision_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.vision_object_workspace(object_name) is not null
    and private.can_write_workspace(private.vision_object_workspace(object_name))
    and exists (
      select 1
      from public.vision_board_items v
      where v.workspace_id = private.vision_object_workspace(object_name)
        and v.id = split_part(object_name, '/', 2)::uuid
    );
$$;

revoke all on function private.vision_object_workspace(text) from public, anon;
revoke all on function private.can_write_vision_object(text) from public, anon;
grant execute on function private.vision_object_workspace(text) to authenticated;
grant execute on function private.can_write_vision_object(text) to authenticated;

create policy "vision-board: members read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vision-board'
    and (select private.is_workspace_member(private.vision_object_workspace(name)))
  );

create policy "vision-board: writers insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vision-board' and (select private.can_write_vision_object(name)));

create policy "vision-board: writers update" on storage.objects
  for update to authenticated
  using (bucket_id = 'vision-board' and (select private.can_write_vision_object(name)))
  with check (bucket_id = 'vision-board' and (select private.can_write_vision_object(name)));

-- Deleting is allowed even after the card is gone, so images of deleted cards can be cleaned up.
create policy "vision-board: writers delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vision-board'
    and (select private.can_write_workspace(private.vision_object_workspace(name)))
  );
