begin;

alter table if exists merch_products
  add column if not exists product_type text;

create index if not exists merch_products_product_type_idx on merch_products(product_type);

alter table if exists merch_products_history
  add column if not exists product_type text,
  add column if not exists merch_flag_source text;

drop trigger if exists merch_products_history_capture on merch_products;
drop function if exists merch_capture_history();

create table if not exists crawler_settings (
  id integer primary key default 1,
  use_best_sellers boolean not null default true,
  zgbs_pages integer not null default 5 check (zgbs_pages between 1 and 20),
  zgbs_paths text[] not null default '{}',
  use_search boolean not null default false,
  search_pages integer not null default 3 check (search_pages between 1 and 20),
  search_category text,
  search_sort text,
  search_rh text,
  search_keywords text[] not null default '{}',
  hidden_include text[] not null default '{}',
  hidden_exclude text[] not null default '{}',
  max_items integer not null default 500 check (max_items between 50 and 5000),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into crawler_settings (id)
values (1)
on conflict (id) do nothing;

alter table crawler_settings enable row level security;

drop policy if exists crawler_settings_select_public on crawler_settings;
create policy crawler_settings_select_public on crawler_settings for select using (true);

drop policy if exists crawler_settings_modify_admin on crawler_settings;
create policy crawler_settings_modify_admin on crawler_settings for insert using (
  coalesce((auth.jwt() ->> 'is_admin')::boolean, false)
) with check (
  coalesce((auth.jwt() ->> 'is_admin')::boolean, false)
);

drop policy if exists crawler_settings_update_admin on crawler_settings;
create policy crawler_settings_update_admin on crawler_settings for update using (
  coalesce((auth.jwt() ->> 'is_admin')::boolean, false)
) with check (
  coalesce((auth.jwt() ->> 'is_admin')::boolean, false)
);

commit;
