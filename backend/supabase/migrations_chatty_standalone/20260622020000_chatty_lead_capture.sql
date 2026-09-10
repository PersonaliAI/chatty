-- Lead-capture toggle + which lead fields are required (subset of lead_fields).
alter table chatty_bots
  add column if not exists lead_capture_enabled boolean default true;
alter table chatty_bots
  add column if not exists lead_required_fields text[] default '{name,email}'::text[];
