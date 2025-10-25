begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'crawler_settings'
      and column_name = 'max_items'
  ) then
    alter table crawler_settings rename column max_items to max_items_per_run;
  end if;
end
$$;

alter table if exists crawler_settings
  drop constraint if exists crawler_settings_zgbs_pages_check,
  drop constraint if exists crawler_settings_search_pages_check,
  drop constraint if exists crawler_settings_max_items_check,
  drop constraint if exists crawler_settings_max_items_per_run_check;

alter table if exists crawler_settings
  alter column max_items_per_run set default 600,
  alter column max_items_per_run type integer using max_items_per_run::integer,
  add constraint crawler_settings_max_items_per_run_check check (max_items_per_run between 100 and 5000),
  add constraint crawler_settings_zgbs_pages_check check (zgbs_pages between 1 and 10),
  alter column search_pages set default 2,
  add constraint crawler_settings_search_pages_check check (search_pages between 1 and 5),
  add column if not exists use_new_releases boolean not null default true,
  add column if not exists new_pages integer not null default 2 check (new_pages between 1 and 5),
  add column if not exists new_paths text[] not null default '{}',
  add column if not exists use_movers boolean not null default true,
  add column if not exists movers_pages integer not null default 2 check (movers_pages between 1 and 3),
  add column if not exists movers_paths text[] not null default '{}',
  add column if not exists recrawl_hours_p0 integer not null default 8,
  add column if not exists recrawl_hours_p1 integer not null default 18,
  add column if not exists recrawl_hours_p2 integer not null default 36,
  add column if not exists recrawl_hours_p3 integer not null default 96,
  add column if not exists per_page_delay_ms_min integer not null default 1500,
  add column if not exists per_page_delay_ms_max integer not null default 3000,
  add column if not exists per_product_delay_ms_min integer not null default 4000,
  add column if not exists per_product_delay_ms_max integer not null default 6000,
  add column if not exists marketplace_id text not null default 'ATVPDKIKX0DER';

update crawler_settings
set
  max_items_per_run = coalesce(max_items_per_run, 600),
  zgbs_pages = least(greatest(coalesce(zgbs_pages, 5), 1), 10),
  search_pages = least(greatest(coalesce(search_pages, 2), 1), 5),
  new_pages = least(greatest(coalesce(new_pages, 2), 1), 5),
  movers_pages = least(greatest(coalesce(movers_pages, 2), 1), 3),
  recrawl_hours_p0 = coalesce(recrawl_hours_p0, 8),
  recrawl_hours_p1 = coalesce(recrawl_hours_p1, 18),
  recrawl_hours_p2 = coalesce(recrawl_hours_p2, 36),
  recrawl_hours_p3 = coalesce(recrawl_hours_p3, 96),
  per_page_delay_ms_min = coalesce(per_page_delay_ms_min, 1500),
  per_page_delay_ms_max = coalesce(per_page_delay_ms_max, 3000),
  per_product_delay_ms_min = coalesce(per_product_delay_ms_min, 4000),
  per_product_delay_ms_max = coalesce(per_product_delay_ms_max, 6000),
  marketplace_id = coalesce(nullif(marketplace_id, ''), 'ATVPDKIKX0DER');

create table if not exists merch_crawl_state (
  asin text primary key,
  priority text not null,
  next_due timestamptz not null,
  last_hash text,
  unchanged_runs integer not null default 0,
  fail_count integer not null default 0,
  inactive boolean not null default false,
  discovery text,
  last_seen_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists merch_crawl_state_next_due_idx on merch_crawl_state(next_due);
create index if not exists merch_crawl_state_priority_idx on merch_crawl_state(priority);

commit;
