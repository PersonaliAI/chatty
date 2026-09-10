-- Lead dedupe (per widget session) + finer geo (city/region).
alter table chatty_leads add column if not exists session_id text;
alter table chatty_leads add column if not exists city text;
alter table chatty_leads add column if not exists region text;
create index if not exists chatty_leads_bot_session_idx
  on chatty_leads (bot_id, session_id);
