begin;

create extension if not exists vector;

create table if not exists merch_products (
  asin text primary key,
  title text,
  brand text,
  price_cents integer,
  rating numeric,
  reviews_count integer,
  bsr integer,
  bsr_category text,
  url text not null,
  image_url text,
  bullet1 text,
  bullet2 text,
  merch_flag_source text,
  first_seen timestamptz not null default timezone('utc', now()),
  last_seen timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists merch_products_history (
  id bigserial primary key,
  asin text references merch_products(asin) on delete cascade,
  price_cents integer,
  rating numeric,
  reviews_count integer,
  bsr integer,
  bsr_category text,
  captured_at timestamptz not null default timezone('utc', now())
);

create table if not exists merch_embeddings (
  asin text primary key references merch_products(asin) on delete cascade,
  content text not null,
  embedding vector(1536),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists merch_trend_metrics (
  asin text primary key references merch_products(asin) on delete cascade,
  bsr_now integer,
  bsr_24h integer,
  bsr_7d integer,
  reviews_now integer,
  reviews_24h integer,
  reviews_7d integer,
  rating_now numeric,
  momentum numeric,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists merch_products_bsr_idx on merch_products(bsr);
create index if not exists merch_products_brand_idx on merch_products using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(brand,'')));
create index if not exists merch_products_history_asin_idx on merch_products_history(asin, captured_at desc);
create index if not exists merch_embeddings_embedding_idx on merch_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists merch_trend_metrics_momentum_idx on merch_trend_metrics(momentum desc);

create or replace function merch_capture_history() returns trigger as $$
begin
  insert into merch_products_history(asin, price_cents, rating, reviews_count, bsr, bsr_category, captured_at)
  values(new.asin, new.price_cents, new.rating, new.reviews_count, new.bsr, new.bsr_category, timezone('utc', now()));
  return new;
end;
$$ language plpgsql;

drop trigger if exists merch_products_history_capture on merch_products;
create trigger merch_products_history_capture
  after insert or update on merch_products
  for each row execute function merch_capture_history();

create or replace function semantic_search_merch(query_vec vector, k integer)
returns table(asin text, content text, score double precision)
language sql
as $$
  select m.asin, e.content, 1 - (e.embedding <=> query_vec) as score
  from merch_embeddings e
  join merch_products m on m.asin = e.asin
  where e.embedding is not null
  order by e.embedding <=> query_vec
  limit least(k, 50);
$$;

alter table merch_products enable row level security;
alter table merch_products_history enable row level security;
alter table merch_embeddings enable row level security;
alter table merch_trend_metrics enable row level security;

drop policy if exists merch_products_select_public on merch_products;
create policy merch_products_select_public on merch_products for select using (true);

drop policy if exists merch_products_mutate_service on merch_products;
create policy merch_products_mutate_service on merch_products for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists merch_products_history_select_public on merch_products_history;
create policy merch_products_history_select_public on merch_products_history for select using (true);

drop policy if exists merch_products_history_insert_service on merch_products_history;
create policy merch_products_history_insert_service on merch_products_history for insert with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists merch_embeddings_select_public on merch_embeddings;
create policy merch_embeddings_select_public on merch_embeddings for select using (true);

drop policy if exists merch_embeddings_mutate_service on merch_embeddings;
create policy merch_embeddings_mutate_service on merch_embeddings for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

drop policy if exists merch_trend_metrics_select_public on merch_trend_metrics;
create policy merch_trend_metrics_select_public on merch_trend_metrics for select using (true);

drop policy if exists merch_trend_metrics_mutate_service on merch_trend_metrics;
create policy merch_trend_metrics_mutate_service on merch_trend_metrics for all using (
  auth.jwt() ->> 'role' = 'service_role'
) with check (
  auth.jwt() ->> 'role' = 'service_role'
);

commit;
