begin;

alter table if exists crawler_settings
  drop constraint if exists crawler_settings_max_items_per_run_check,
  drop constraint if exists crawler_settings_zgbs_pages_check,
  drop constraint if exists crawler_settings_search_pages_check,
  drop constraint if exists crawler_settings_new_pages_check,
  drop constraint if exists crawler_settings_movers_pages_check;

alter table if exists crawler_settings
  add constraint crawler_settings_max_items_per_run_check check (max_items_per_run >= 100),
  add constraint crawler_settings_zgbs_pages_check check (zgbs_pages >= 1),
  add constraint crawler_settings_search_pages_check check (search_pages >= 1),
  add constraint crawler_settings_new_pages_check check (new_pages >= 1),
  add constraint crawler_settings_movers_pages_check check (movers_pages >= 1);

commit;
