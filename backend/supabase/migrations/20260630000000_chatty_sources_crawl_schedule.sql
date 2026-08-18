-- Recurring auto-crawl for URL knowledge sources: 'off' | 'daily' | 'weekly' | 'monthly'.
alter table chatty_sources add column if not exists crawl_schedule text default 'off';
alter table chatty_sources add column if not exists next_crawl_at timestamptz;
alter table chatty_sources add column if not exists last_crawled_at timestamptz;
