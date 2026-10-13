-- Phase 6 (part 2): validated import / restore of a workspace backup (REQUIREMENTS 8.5).
--
-- Restoring a backup must set columns that clients are not granted (completed_at, recurrence
-- series fields, idea conversions), so it runs in one security-definer function. Safety is kept by
-- checking the CALLER's membership of the target workspace explicitly (auth.uid() is the caller's,
-- even inside a definer function) and validating the payload before writing. The whole import is one
-- transaction: any failure rolls everything back, so the workspace is never left half-written.
--
-- Rows are loaded with jsonb_populate_recordset against each table's row type (which validates
-- types, ignores unknown keys, and rejects malformed values), after rewriting every row's
-- workspace_id to the target. IDs and cross-row references are preserved, so composite
-- (id, workspace_id) foreign keys still resolve. Tables are written parent-first so references
-- always exist; a "replace" first clears the target in child-first order.
--
-- Fidelity note: inserting a task with status 'done' re-stamps completed_at to now() (the tasks
-- trigger owns that column), so restored completion timestamps change. Everything else is faithful.

create function public.import_workspace(target_workspace uuid, payload jsonb, mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Parent-first insert order; the reverse is a safe child-first delete order.
  tbls text[] := array[
    'areas', 'tags', 'goals', 'projects', 'milestones', 'habits', 'tasks', 'ideas', 'plans',
    'plan_items', 'habit_logs', 'vision_board_items', 'time_blocks', 'notes', 'journal_entries',
    'focus_sessions', 'weekly_reviews', 'task_tags', 'task_dependencies', 'idea_tags', 'note_tags',
    'journal_entry_tags', 'reminder_preferences'
  ];
  tbl text;
  rows jsonb;
  rewritten jsonb;
  inserted integer;
  total integer := 0;
  summary jsonb := '{}'::jsonb;
  i integer;
begin
  if not (select private.can_write_workspace(target_workspace)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if coalesce((payload ->> 'schema_version')::int, 0) <> 1 then
    raise exception 'BAD_SCHEMA_VERSION' using errcode = 'P0001';
  end if;
  if mode not in ('replace', 'merge') then
    raise exception 'BAD_MODE' using errcode = 'P0001';
  end if;
  if jsonb_typeof(payload -> 'records') <> 'object' then
    raise exception 'BAD_PAYLOAD' using errcode = 'P0001';
  end if;

  if mode = 'replace' then
    for i in reverse array_length(tbls, 1)..1 loop
      execute format('delete from public.%I where workspace_id = $1', tbls[i])
        using target_workspace;
    end loop;
  end if;

  foreach tbl in array tbls loop
    rows := payload -> 'records' -> tbl;
    if rows is null or jsonb_typeof(rows) <> 'array' then
      continue;
    end if;
    -- Force every row into the target workspace, keeping all other columns and references.
    rewritten := (
      select coalesce(
        jsonb_agg(elem || jsonb_build_object('workspace_id', target_workspace)),
        '[]'::jsonb
      )
      from jsonb_array_elements(rows) elem
    );
    execute format(
      'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) '
      'on conflict do nothing',
      tbl, tbl
    ) using rewritten;
    get diagnostics inserted = row_count;
    total := total + inserted;
    summary := summary || jsonb_build_object(tbl, inserted);
  end loop;

  return jsonb_build_object('inserted', total, 'tables', summary);
end;
$$;

revoke all on function public.import_workspace(uuid, jsonb, text) from public, anon;
grant execute on function public.import_workspace(uuid, jsonb, text) to authenticated;
