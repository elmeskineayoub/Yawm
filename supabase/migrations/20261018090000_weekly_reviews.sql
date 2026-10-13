-- Phase 5 (part 3): the weekly review's reflection.
--
-- The quantitative side of the weekly review (completed/carried tasks, habit rates, focus time,
-- project and goal progress) is derived from existing rows and never stored. This table stores only
-- the reflective prompts for a given week (REQUIREMENTS 6.14), one row per week. It is deliberately
-- separate from the week `plan` (which holds the forward-looking theme/focus/priorities): the plan
-- is intention, the review is retrospective.
--
-- Security model is identical to every earlier phase: RLS; members read; owner/admin/member write;
-- viewers read-only; signed-out callers get nothing; workspace_id can never change.

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- The Monday-or-configured week-start date the review is about (date-only, user's timezone).
  week_start date not null,
  went_well text check (char_length(went_well) <= 5000),
  could_improve text check (char_length(could_improve) <= 5000),
  lessons text check (char_length(lessons) <= 5000),
  next_focus text check (char_length(next_focus) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, week_start)
);

create index weekly_reviews_workspace_week_idx
  on public.weekly_reviews (workspace_id, week_start desc);

create trigger weekly_reviews_set_updated_at before update on public.weekly_reviews
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.weekly_reviews from anon, authenticated;
grant select, delete on table public.weekly_reviews to authenticated;
grant insert (workspace_id, week_start, went_well, could_improve, lessons, next_focus)
  on public.weekly_reviews to authenticated;
grant update (went_well, could_improve, lessons, next_focus)
  on public.weekly_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: the same rules as every workspace-scoped table.
-- ---------------------------------------------------------------------------

alter table public.weekly_reviews enable row level security;

create policy "weekly_reviews: members read" on public.weekly_reviews
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "weekly_reviews: writers insert" on public.weekly_reviews
  for insert to authenticated
  with check ((select private.can_write_workspace(workspace_id)));
create policy "weekly_reviews: writers update" on public.weekly_reviews
  for update to authenticated
  using ((select private.can_write_workspace(workspace_id)))
  with check ((select private.can_write_workspace(workspace_id)));
create policy "weekly_reviews: writers delete" on public.weekly_reviews
  for delete to authenticated
  using ((select private.can_write_workspace(workspace_id)));
