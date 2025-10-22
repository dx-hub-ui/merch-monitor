begin;

create table if not exists keywords (
  term text not null,
  alias text not null,
  normalized text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (term, alias)
);

create table if not exists keyword_suggestions (
  id bigserial primary key,
  term text not null,
  alias text not null,
  position integer not null,
  fetched_at timestamptz not null default timezone('utc', now())
);

create table if not exists keyword_explore_cache (
  term text not null,
  alias text not null,
  response jsonb not null,
  fetched_at timestamptz not null default timezone('utc', now()),
  primary key (term, alias)
);

create table if not exists keyword_embeddings (
  term text not null,
  alias text not null,
  embedding vector(1536),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (term, alias)
);

create index if not exists keyword_embeddings_alias_idx on keyword_embeddings(alias);
create index if not exists keyword_embeddings_embedding_idx on keyword_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists keyword_serp_queue (
  id bigserial primary key,
  term text not null,
  alias text not null,
  priority integer not null default 0,
  requested_at timestamptz not null default timezone('utc', now()),
  status text not null default 'pending'
);

create index if not exists keyword_serp_queue_status_idx on keyword_serp_queue(status, priority desc, requested_at);

create table if not exists keyword_serp_snapshot (
  id bigserial primary key,
  term text not null,
  alias text not null,
  page integer not null check (page > 0),
  position integer not null check (position > 0),
  asin text not null,
  bsr integer,
  reviews integer,
  rating numeric,
  price_cents integer,
  title text,
  brand text,
  is_merch boolean not null default false,
  product_type text,
  fetched_at timestamptz not null default timezone('utc', now())
);

create index if not exists keyword_serp_snapshot_term_alias_idx on keyword_serp_snapshot(term, alias, fetched_at desc);
create index if not exists keyword_serp_snapshot_asin_idx on keyword_serp_snapshot(asin, fetched_at desc);

create table if not exists keyword_metrics_daily (
  term text not null,
  alias text not null,
  date date not null,
  avg_bsr numeric,
  med_bsr numeric,
  share_merch numeric,
  avg_reviews numeric,
  med_reviews numeric,
  top10_reviews_p80 numeric,
  serp_diversity numeric,
  price_iqr numeric,
  difficulty numeric not null,
  competition numeric not null,
  opportunity numeric not null,
  momentum_7d numeric,
  momentum_30d numeric,
  samples integer not null,
  intent_tags text[],
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (term, alias, date)
);

create index if not exists keyword_metrics_daily_term_date_idx on keyword_metrics_daily(term, alias, date desc);

create table if not exists keyword_settings (
  id integer primary key default 1,
  aliases text[] not null default '{}',
  bfs_depth integer not null default 2,
  serp_pages integer not null default 3,
  topn integer not null default 50,
  weight_reviews numeric not null default 0.35,
  weight_bsr numeric not null default 0.25,
  weight_merch numeric not null default 0.2,
  weight_rating numeric not null default 0.1,
  weight_diversity numeric not null default 0.1,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into keyword_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function match_keyword_embeddings(
  query_embedding vector(1536),
  match_count int default 10,
  target_alias text default null
)
returns table(term text, alias text, distance double precision)
language sql
stable
as $$
  select term, alias, 1 - (embedding <=> query_embedding) as distance
  from keyword_embeddings
  where embedding is not null
    and (target_alias is null or alias = target_alias)
  order by embedding <=> query_embedding
  limit greatest(coalesce(match_count, 10), 1);
$$;

alter table keywords enable row level security;
alter table keyword_suggestions enable row level security;
alter table keyword_explore_cache enable row level security;
alter table keyword_embeddings enable row level security;
alter table keyword_serp_queue enable row level security;
alter table keyword_serp_snapshot enable row level security;
alter table keyword_metrics_daily enable row level security;
alter table keyword_settings enable row level security;

drop policy if exists keywords_select_public on keywords;
create policy keywords_select_public on keywords for select using (true);

drop policy if exists keywords_modify_service on keywords;
create policy keywords_modify_service on keywords for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists keyword_suggestions_select_public on keyword_suggestions;
create policy keyword_suggestions_select_public on keyword_suggestions for select using (true);

drop policy if exists keyword_suggestions_modify_service on keyword_suggestions;
create policy keyword_suggestions_modify_service on keyword_suggestions for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists keyword_explore_cache_select_public on keyword_explore_cache;
create policy keyword_explore_cache_select_public on keyword_explore_cache for select using (true);

drop policy if exists keyword_explore_cache_modify_service on keyword_explore_cache;
create policy keyword_explore_cache_modify_service on keyword_explore_cache for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists keyword_embeddings_select_public on keyword_embeddings;
create policy keyword_embeddings_select_public on keyword_embeddings for select using (true);

drop policy if exists keyword_embeddings_modify_service on keyword_embeddings;
create policy keyword_embeddings_modify_service on keyword_embeddings for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists keyword_serp_queue_select_public on keyword_serp_queue;
create policy keyword_serp_queue_select_public on keyword_serp_queue for select using (true);

drop policy if exists keyword_serp_queue_modify_service on keyword_serp_queue;
create policy keyword_serp_queue_modify_service on keyword_serp_queue for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists keyword_serp_snapshot_select_public on keyword_serp_snapshot;
create policy keyword_serp_snapshot_select_public on keyword_serp_snapshot for select using (true);

drop policy if exists keyword_serp_snapshot_modify_service on keyword_serp_snapshot;
create policy keyword_serp_snapshot_modify_service on keyword_serp_snapshot for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists keyword_metrics_daily_select_public on keyword_metrics_daily;
create policy keyword_metrics_daily_select_public on keyword_metrics_daily for select using (true);

drop policy if exists keyword_metrics_daily_modify_service on keyword_metrics_daily;
create policy keyword_metrics_daily_modify_service on keyword_metrics_daily for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists keyword_settings_select_public on keyword_settings;
create policy keyword_settings_select_public on keyword_settings for select using (true);

drop policy if exists keyword_settings_modify_service on keyword_settings;
create policy keyword_settings_modify_service on keyword_settings for all using (
  auth.jwt() ->> 'role' = 'service_role' or coalesce((auth.jwt() ->> 'is_admin')::boolean, false)
) with check (
  auth.jwt() ->> 'role' = 'service_role' or coalesce((auth.jwt() ->> 'is_admin')::boolean, false)
);

commit;
