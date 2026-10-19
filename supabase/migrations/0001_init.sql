-- Core schema for the practice platform.
-- Every table has RLS enabled and NO policies: the browser (anon/authenticated
-- roles) cannot read or write anything directly. All access goes through the
-- Next.js server using the service-role key, which enforces ownership.

create extension if not exists pgcrypto;

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index guests_ip_hash_created_idx on public.guests (ip_hash, created_at);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  guest_id uuid references public.guests (id) on delete set null,
  challenge_slug text not null,
  challenge_version text not null,
  mode text not null check (mode in ('interview', 'guided')),
  status text not null default 'active'
    check (status in ('active', 'twist', 'explain', 'completed')),
  files jsonb not null default '{}'::jsonb,
  explanation text,
  hints_unlocked int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  twist_unlocked_at timestamptz,
  completed_at timestamptz,
  constraint session_has_owner check (user_id is not null or guest_id is not null)
);
create index practice_sessions_user_idx on public.practice_sessions (user_id, created_at desc);
create index practice_sessions_guest_idx on public.practice_sessions (guest_id, created_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  label text,
  blocked boolean not null default false,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(12, 6),
  created_at timestamptz not null default now()
);
create index messages_session_idx on public.messages (session_id, id);

create table public.events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_session_idx on public.events (session_id, id);

create table public.submissions (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  stage text not null check (stage in ('main', 'twist')),
  passed int not null,
  total int not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);
create index submissions_session_idx on public.submissions (session_id, id);

create table public.reports (
  id bigint generated always as identity primary key,
  session_id uuid not null unique references public.practice_sessions (id) on delete cascade,
  overall int,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Quota counters: one row per (key, window). Incremented atomically.
create table public.usage_counters (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Estimated AI + sandbox spend per UTC day, for the global spend cap.
create table public.spend_daily (
  day date primary key,
  cost_usd numeric(12, 6) not null default 0
);

alter table public.guests enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.submissions enable row level security;
alter table public.reports enable row level security;
alter table public.usage_counters enable row level security;
alter table public.spend_daily enable row level security;

-- Atomically add p_amount to a counter unless that would exceed p_limit.
-- Returns true if the amount was consumed.
create or replace function public.consume_quota(
  p_key text, p_window timestamptz, p_limit int, p_amount int default 1
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_amount > p_limit then
    return false;
  end if;
  insert into usage_counters as uc (key, window_start, count)
  values (p_key, p_window, p_amount)
  on conflict (key, window_start) do update
    set count = uc.count + p_amount
    where uc.count + p_amount <= p_limit
  returning count into v_count;
  return v_count is not null;
end;
$$;

create or replace function public.add_spend(p_day date, p_cost numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
begin
  insert into spend_daily as s (day, cost_usd) values (p_day, p_cost)
  on conflict (day) do update set cost_usd = s.cost_usd + p_cost
  returning cost_usd into v_total;
  return v_total;
end;
$$;

revoke all on function public.consume_quota(text, timestamptz, int, int) from public, anon, authenticated;
revoke all on function public.add_spend(date, numeric) from public, anon, authenticated;
grant execute on function public.consume_quota(text, timestamptz, int, int) to service_role;
grant execute on function public.add_spend(date, numeric) to service_role;
