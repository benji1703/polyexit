create extension if not exists citext;

create type public.member_role as enum ('member', 'moderator', 'admin');
create type public.member_status as enum ('active', 'disabled');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
create type public.market_category as enum ('people', 'company', 'secondary');
create type public.market_status as enum ('open', 'resolved', 'void');
create type public.market_outcome as enum ('yes', 'no');
create type public.market_resolution as enum ('yes', 'no', 'void');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role public.member_role not null default 'member',
  status public.member_status not null default 'active',
  balance integer not null default 2500 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitations (
  email citext primary key,
  role public.member_role not null default 'member' check (role <> 'admin'),
  status public.invitation_status not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category public.market_category not null,
  title text not null check (char_length(title) between 10 and 140),
  description text not null check (char_length(description) between 20 and 600),
  resolution_source text not null check (char_length(resolution_source) between 10 and 300),
  closes_at timestamptz not null,
  status public.market_status not null default 'open',
  resolved_outcome public.market_resolution,
  resolved_at timestamptz,
  initial_probability smallint not null default 50 check (initial_probability between 5 and 95),
  featured boolean not null default false,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((status = 'open' and resolved_outcome is null and resolved_at is null) or (status <> 'open' and resolved_outcome is not null and resolved_at is not null))
);

create unique index markets_one_featured_open_idx on public.markets (featured) where featured = true and status = 'open';
create index markets_open_closes_idx on public.markets (status, closes_at);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  outcome public.market_outcome not null,
  stake integer not null check (stake between 10 and 1000),
  created_at timestamptz not null default now(),
  unique (market_id, user_id)
);
create index positions_market_idx on public.positions (market_id, outcome);
create index positions_user_idx on public.positions (user_id, created_at desc);

create table public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  market_id uuid references public.markets(id) on delete restrict,
  delta integer not null check (delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null check (reason in ('welcome_grant', 'position_stake', 'market_payout', 'market_refund', 'admin_adjustment')),
  created_at timestamptz not null default now()
);
create index coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 3 and 80),
  target_type text not null check (char_length(target_type) between 2 and 40),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.rate_limits (
  key_hash text not null check (char_length(key_hash) = 64),
  bucket bigint not null,
  hits integer not null default 1 check (hits > 0),
  expires_at timestamptz not null,
  primary key (key_hash, bucket)
);

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.markets enable row level security;
alter table public.positions enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.profiles, public.invitations, public.markets, public.positions, public.coin_ledger, public.audit_log, public.rate_limits from anon, authenticated;
grant all on public.profiles, public.invitations, public.markets, public.positions, public.coin_ledger, public.audit_log, public.rate_limits to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket bigint;
  v_hits integer;
begin
  if char_length(p_key) <> 64 or p_limit < 1 or p_limit > 1000 or p_window_seconds < 10 or p_window_seconds > 86400 then
    return false;
  end if;
  v_bucket := floor(extract(epoch from clock_timestamp()) / p_window_seconds);
  insert into public.rate_limits(key_hash, bucket, hits, expires_at)
  values (p_key, v_bucket, 1, clock_timestamp() + make_interval(secs => p_window_seconds * 2))
  on conflict (key_hash, bucket) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then delete from public.rate_limits where expires_at < clock_timestamp(); end if;
  return v_hits <= p_limit;
end;
$$;

create or replace function public.place_position(p_user_id uuid, p_market_id uuid, p_outcome public.market_outcome, p_stake integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance integer;
  v_status public.member_status;
  v_market_status public.market_status;
  v_closes_at timestamptz;
begin
  if p_stake < 10 or p_stake > 1000 then raise exception 'Invalid stake'; end if;
  select status, balance into v_status, v_balance from public.profiles where id = p_user_id for update;
  if not found or v_status <> 'active' then raise exception 'Account is not active'; end if;
  select status, closes_at into v_market_status, v_closes_at from public.markets where id = p_market_id for update;
  if not found or v_market_status <> 'open' or v_closes_at <= clock_timestamp() then raise exception 'Market is closed'; end if;
  if exists (select 1 from public.positions where market_id = p_market_id and user_id = p_user_id) then raise exception 'User already has a position'; end if;
  if v_balance < p_stake then raise exception 'Insufficient balance'; end if;
  update public.profiles set balance = balance - p_stake, updated_at = clock_timestamp() where id = p_user_id returning balance into v_balance;
  insert into public.positions(market_id, user_id, outcome, stake) values (p_market_id, p_user_id, p_outcome, p_stake);
  insert into public.coin_ledger(user_id, market_id, delta, balance_after, reason) values (p_user_id, p_market_id, -p_stake, v_balance, 'position_stake');
  insert into public.audit_log(actor_id, action, target_type, target_id, metadata) values (p_user_id, 'position.created', 'market', p_market_id, jsonb_build_object('outcome', p_outcome, 'stake', p_stake));
  return v_balance;
end;
$$;

create or replace function public.activate_profile(p_user_id uuid, p_email citext, p_display_name text, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
begin
  if p_user_id is null or p_email is null or char_length(p_display_name) not between 1 and 60 then
    raise exception 'Invalid profile';
  end if;
  select true into v_exists from public.profiles where id = p_user_id for update;
  if coalesce(v_exists, false) then
    update public.profiles set email = lower(p_email), display_name = p_display_name,
      role = p_role, status = 'active', updated_at = clock_timestamp() where id = p_user_id;
  else
    insert into public.profiles(id, email, display_name, role, status, balance)
      values (p_user_id, lower(p_email), p_display_name, p_role, 'active', 2500);
    insert into public.coin_ledger(user_id, delta, balance_after, reason)
      values (p_user_id, 2500, 2500, 'welcome_grant');
  end if;
  update public.invitations set status = 'accepted', accepted_at = coalesce(accepted_at, clock_timestamp())
    where email = lower(p_email) and status in ('pending', 'accepted');
  insert into public.audit_log(actor_id, action, target_type, target_id)
    values (p_user_id, 'profile.activated', 'profile', p_user_id);
end;
$$;

create or replace function public.settle_market(p_admin_id uuid, p_market_id uuid, p_outcome public.market_resolution)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.member_role;
  v_status public.market_status;
  v_total_pool bigint;
  v_winner_pool bigint;
  v_payout integer;
  v_balance integer;
  v_position record;
begin
  select role into v_role from public.profiles where id = p_admin_id and status = 'active' for update;
  if not found or v_role <> 'admin' then raise exception 'Admin required'; end if;
  select status into v_status from public.markets where id = p_market_id for update;
  if not found or v_status <> 'open' then raise exception 'Market is not open'; end if;
  select coalesce(sum(stake), 0), coalesce(sum(stake) filter (where outcome::text = p_outcome::text), 0)
    into v_total_pool, v_winner_pool from public.positions where market_id = p_market_id;
  update public.markets set status = case when p_outcome = 'void' then 'void'::public.market_status else 'resolved'::public.market_status end,
    resolved_outcome = p_outcome, resolved_at = clock_timestamp(), featured = false where id = p_market_id;
  for v_position in select user_id, outcome, stake from public.positions where market_id = p_market_id order by id for update loop
    if p_outcome = 'void' or v_winner_pool = 0 then
      v_payout := v_position.stake;
    elsif v_position.outcome::text = p_outcome::text then
      v_payout := floor(v_total_pool::numeric * v_position.stake::numeric / v_winner_pool::numeric);
    else
      continue;
    end if;
    update public.profiles set balance = balance + v_payout, updated_at = clock_timestamp() where id = v_position.user_id returning balance into v_balance;
    insert into public.coin_ledger(user_id, market_id, delta, balance_after, reason)
      values (v_position.user_id, p_market_id, v_payout, v_balance, case when p_outcome = 'void' or v_winner_pool = 0 then 'market_refund' else 'market_payout' end);
  end loop;
  insert into public.audit_log(actor_id, action, target_type, target_id, metadata)
    values (p_admin_id, 'market.settled', 'market', p_market_id, jsonb_build_object('outcome', p_outcome, 'pool', v_total_pool));
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.place_position(uuid, uuid, public.market_outcome, integer) from public, anon, authenticated;
revoke all on function public.activate_profile(uuid, citext, text, public.member_role) from public, anon, authenticated;
revoke all on function public.settle_market(uuid, uuid, public.market_resolution) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.place_position(uuid, uuid, public.market_outcome, integer) to service_role;
grant execute on function public.activate_profile(uuid, citext, text, public.member_role) to service_role;
grant execute on function public.settle_market(uuid, uuid, public.market_resolution) to service_role;

insert into public.markets(slug, category, title, description, resolution_source, closes_at, initial_probability, featured)
values
  ('next-secondary-before-december', 'secondary', 'Will the next secondary window open before December?', 'Forecast the timing of the next formally announced employee liquidity event.', 'A formal company-wide announcement with a stated opening date.', date_trunc('year', now()) + interval '11 months', 64, true),
  ('acquisition-announced-this-year', 'company', 'Will an acquisition be announced before year-end?', 'A broad company-level forecast without naming or alleging a specific buyer.', 'A signed transaction announced through an official company channel.', date_trunc('year', now()) + interval '1 year' - interval '1 day', 38, false),
  ('voluntary-move-before-q4', 'people', 'Will the next opt-in voluntary move be announced before Q4?', 'Only voluntarily participating colleagues may be named in any future market detail.', 'The participating person announces their move in a shared company channel.', date_trunc('year', now()) + interval '9 months', 52, false);
