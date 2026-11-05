-- Focus time per project (Focus redesign): a focus session can be attributed to a project directly,
-- so time spent on a project is tracked even without a specific task.
--
-- * project_id is optional, like task_id. A composite (project_id, workspace_id) foreign key means a
--   session can only point at a project in its own workspace; deleting a project keeps the
--   session's time but clears the link (the same rule as task_id).
-- * Task and project stay consistent: when a session names a task that belongs to a project, the
--   project is filled in from the task, and a session that names a different project is rejected.
-- * Existing sessions keep working (project_id is null). Sessions already linked to a task that
--   belongs to a project are attributed to that project once, here.
-- * RLS policies are unchanged; the insert grant gains the new column. Sessions stay immutable
--   (no update grant).

alter table public.focus_sessions add column project_id uuid;

alter table public.focus_sessions
  add constraint focus_sessions_project_fk
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id)
  on delete set null (project_id);

-- Per-project totals (project page, focus page).
create index focus_sessions_project_idx
  on public.focus_sessions (workspace_id, project_id, started_at desc)
  where project_id is not null;

grant insert (project_id) on public.focus_sessions to authenticated;

-- Keep task and project consistent on insert. Runs as the caller, so it only sees tasks the caller
-- can read (their own workspace), which the foreign keys already require.
create function private.focus_sessions_project_from_task()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  task_project uuid;
begin
  if new.task_id is null then
    return new;
  end if;
  select t.project_id into task_project
  from public.tasks t
  where t.id = new.task_id and t.workspace_id = new.workspace_id;
  if task_project is null then
    return new;
  end if;
  if new.project_id is null then
    new.project_id := task_project;
  elsif new.project_id <> task_project then
    raise exception 'FOCUS_PROJECT_MISMATCH: the task belongs to another project'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger focus_sessions_project_from_task
  before insert on public.focus_sessions
  for each row execute function private.focus_sessions_project_from_task();

-- Attribute existing task-linked sessions to their task's project.
update public.focus_sessions fs
set project_id = t.project_id
from public.tasks t
where fs.task_id = t.id
  and fs.workspace_id = t.workspace_id
  and fs.project_id is null
  and t.project_id is not null;
