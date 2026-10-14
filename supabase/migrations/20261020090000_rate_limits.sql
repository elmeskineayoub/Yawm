-- Application-level rate limiting (REQUIREMENTS 11; security audit Finding #1).
--
-- A durable, fixed-window counter in the non-exposed `private` schema, driven only through a
-- security-definer RPC. The table is never exposed to PostgREST (it is not in `public`) and has no
-- role grants, so clients can only touch it via rate_limit_hit(). The RPC is granted to anon too,
-- because auth endpoints (sign-in/up, reset) are hit before a session exists; a fixed bucket
-- allowlist and identifier truncation keep that surface bounded, and expired windows are pruned.

create table private.rate_limits (
  bucket text not null,
  identifier text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, identifier, window_start)
);

create index rate_limits_window_idx on private.rate_limits (window_start);

-- Increments the counter for (bucket, identifier) in the current window and reports whether the
-- caller is still within `p_max`. Returns { allowed: bool, retry_after: seconds }.
create function public.rate_limit_hit(
  p_bucket text,
  p_identifier text,
  p_max integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws timestamptz;
  current_count integer;
begin
  if p_bucket is null or p_identifier is null
    or coalesce(p_max, 0) < 1 or coalesce(p_window_seconds, 0) < 1 then
    raise exception 'BAD_RATE_LIMIT_ARGS' using errcode = 'P0001';
  end if;
  -- Only the app's own buckets; prevents the RPC being used as a general-purpose counter store.
  if p_bucket not in ('auth:signin', 'auth:signup', 'auth:reset', 'export', 'google:sync') then
    raise exception 'UNKNOWN_RATE_LIMIT_BUCKET' using errcode = 'P0001';
  end if;

  p_window_seconds := least(p_window_seconds, 7200);
  p_max := least(p_max, 100000);
  ws := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limits (bucket, identifier, window_start, count)
  values (p_bucket, left(p_identifier, 200), ws, 1)
  on conflict (bucket, identifier, window_start)
  do update set count = private.rate_limits.count + 1
  returning count into current_count;

  -- Opportunistic cleanup: windows are at most 2h, so anything older is dead.
  delete from private.rate_limits where window_start < now() - interval '2 hours';

  if current_count > p_max then
    return jsonb_build_object(
      'allowed', false,
      'retry_after',
      greatest(1, ceil(extract(epoch from (ws + make_interval(secs => p_window_seconds)) - now())))::int
    );
  end if;
  return jsonb_build_object('allowed', true, 'retry_after', 0);
end;
$$;

revoke all on function public.rate_limit_hit(text, text, integer, integer) from public;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to anon, authenticated;
