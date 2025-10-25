begin;

alter table users_profile
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists timezone text not null default 'UTC';

update users_profile
set timezone = coalesce(nullif(timezone, ''), 'UTC')
where timezone is null or timezone = '';

commit;
