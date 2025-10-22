begin;

create table if not exists users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_tier text not null default 'basic' check (plan_tier in ('basic', 'pro')),
  plan_status text not null default 'inactive' check (plan_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  seats integer not null default 1 check (seats >= 1),
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  metric text not null,
  used integer not null default 0 check (used >= 0),
  limit integer not null check (limit >= 0),
  primary key (user_id, date, metric)
);

create table if not exists subscription_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscription_events_user_id_idx on subscription_events(user_id, created_at desc);

alter table users_profile enable row level security;
alter table usage_counters enable row level security;
alter table subscription_events enable row level security;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (user_id, plan_tier, plan_status, trial_ends_at, updated_at)
  values (new.id, 'basic', 'trialing', timezone('utc', now()) + interval '7 days', timezone('utc', now()))
  on conflict (user_id)
    do update set updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user_profile();

create or replace function public.handle_users_profile_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists users_profile_set_timestamp on public.users_profile;
create trigger users_profile_set_timestamp
  before update on public.users_profile
  for each row
  execute procedure public.handle_users_profile_timestamp();

create or replace function public.jwt_custom_claims()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'plan_tier', up.plan_tier,
    'plan_status', up.plan_status,
    'trial_active', coalesce(up.trial_ends_at > timezone('utc', now()), false),
    'trial_ends_at', up.trial_ends_at,
    'seats', up.seats
  )
  from public.users_profile up
  where up.user_id = auth.uid();
$$;

drop policy if exists users_profile_select_self on public.users_profile;
create policy users_profile_select_self on public.users_profile
  for select
  using (auth.uid() = user_id);

drop policy if exists users_profile_update_self on public.users_profile;
create policy users_profile_update_self on public.users_profile
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists users_profile_service_full on public.users_profile;
create policy users_profile_service_full on public.users_profile
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists usage_counters_select_self on public.usage_counters;
create policy usage_counters_select_self on public.usage_counters
  for select
  using (auth.uid() = user_id);

drop policy if exists usage_counters_update_self on public.usage_counters;
create policy usage_counters_update_self on public.usage_counters
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists usage_counters_insert_self on public.usage_counters;
create policy usage_counters_insert_self on public.usage_counters
  for insert
  with check (auth.uid() = user_id);

drop policy if exists usage_counters_service_full on public.usage_counters;
create policy usage_counters_service_full on public.usage_counters
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists subscription_events_service on public.subscription_events;
create policy subscription_events_service on public.subscription_events
  for select using (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists subscription_events_insert_service on public.subscription_events;
create policy subscription_events_insert_service on public.subscription_events
  for insert
  with check (auth.jwt() ->> 'role' = 'service_role');

create or replace function public.increment_usage(
  p_user_id uuid,
  p_metric text,
  p_limit integer,
  p_delta integer default 1
)
returns table(used integer, limit integer, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := timezone('utc', now())::date;
  v_limit integer := greatest(p_limit, 0);
  v_row usage_counters%rowtype;
  v_allowed boolean := false;
begin
  if p_delta <= 0 then
    raise exception 'delta must be positive';
  end if;

  <<retry>>
  loop
    begin
      select *
      into v_row
      from public.usage_counters
      where user_id = p_user_id
        and date = v_date
        and metric = p_metric
      for update;

      if not found then
        v_allowed := p_delta <= v_limit;
        begin
          insert into public.usage_counters (user_id, date, metric, used, limit)
          values (
            p_user_id,
            v_date,
            p_metric,
            case when v_allowed then p_delta else v_limit end,
            v_limit
          )
          returning * into v_row;
          exit;
        exception
          when unique_violation then
            continue retry;
        end;
      else
        v_limit := greatest(v_limit, v_row.limit);
        v_allowed := v_row.used + p_delta <= v_limit;
        if v_allowed then
          update public.usage_counters
          set used = v_row.used + p_delta,
              limit = v_limit
          where user_id = p_user_id
            and date = v_date
            and metric = p_metric
          returning * into v_row;
        else
          update public.usage_counters
          set limit = v_limit
          where user_id = p_user_id
            and date = v_date
            and metric = p_metric
          returning * into v_row;
        end if;
        exit;
      end if;
    end;
  end loop;

  return query select v_row.used, v_limit, v_allowed;
end;
$$;

create or replace function public.reset_usage_limits(
  p_user_id uuid,
  p_date date,
  p_metric text,
  p_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_counters (user_id, date, metric, used, limit)
  values (p_user_id, p_date, p_metric, 0, p_limit)
  on conflict (user_id, date, metric)
    do update set used = 0, limit = p_limit;
end;
$$;

commit;
