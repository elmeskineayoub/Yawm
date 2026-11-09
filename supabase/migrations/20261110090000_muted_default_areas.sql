-- Default life areas for new accounts in Yawm's muted palette.
--
-- The original defaults (violet, sky blue, bright green, amber) clashed with the charcoal / ivory /
-- greige identity: area dots appear on every task row. This redefines the signup trigger function
-- with the same body and only the four default colours changed (slate, sage, ochre, warm taupe),
-- each still distinguishable as an 8px dot in light and dark themes.
--
-- Only accounts created after this migration are affected. Existing areas are user data and keep
-- their colours (they can be changed in Settings → Life areas). No table, policy, or grant changes:
-- `create or replace` keeps the function's owner, privileges, and the existing trigger.

create or replace function private.handle_new_user()
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
    (new_workspace_id, 'Spiritual', '#857a6e', 0),
    (new_workspace_id, 'Mental', '#687a8f', 1),
    (new_workspace_id, 'Physical', '#6b8770', 2),
    (new_workspace_id, 'Finances', '#a08656', 3);

  return new;
end;
$$;
