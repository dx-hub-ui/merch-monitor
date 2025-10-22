begin;

create table if not exists keyword_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists keyword_lists_user_id_idx on keyword_lists(user_id);

create table if not exists keyword_list_items (
  id bigint generated always as identity primary key,
  list_id uuid not null references keyword_lists(id) on delete cascade,
  term text not null,
  normalized text not null,
  alias text not null default 'us',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique(list_id, normalized, alias)
);

create index if not exists keyword_list_items_list_id_idx on keyword_list_items(list_id);

alter table keyword_lists enable row level security;
alter table keyword_list_items enable row level security;

create or replace function set_keyword_lists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger keyword_lists_updated_at
before update on keyword_lists
for each row
execute function set_keyword_lists_updated_at();

create policy keyword_lists_owner_select on keyword_lists
  for select using (auth.uid() = user_id);

create policy keyword_lists_owner_insert on keyword_lists
  for insert with check (auth.uid() = user_id);

create policy keyword_lists_owner_update on keyword_lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy keyword_lists_owner_delete on keyword_lists
  for delete using (auth.uid() = user_id);

create policy keyword_list_items_owner_select on keyword_list_items
  for select using (
    exists (
      select 1 from keyword_lists
      where keyword_lists.id = keyword_list_items.list_id
        and keyword_lists.user_id = auth.uid()
    )
  );

create policy keyword_list_items_owner_insert on keyword_list_items
  for insert with check (
    exists (
      select 1 from keyword_lists
      where keyword_lists.id = keyword_list_items.list_id
        and keyword_lists.user_id = auth.uid()
    )
  );

create policy keyword_list_items_owner_update on keyword_list_items
  for update using (
    exists (
      select 1 from keyword_lists
      where keyword_lists.id = keyword_list_items.list_id
        and keyword_lists.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from keyword_lists
      where keyword_lists.id = keyword_list_items.list_id
        and keyword_lists.user_id = auth.uid()
    )
  );

create policy keyword_list_items_owner_delete on keyword_list_items
  for delete using (
    exists (
      select 1 from keyword_lists
      where keyword_lists.id = keyword_list_items.list_id
        and keyword_lists.user_id = auth.uid()
    )
  );

commit;
