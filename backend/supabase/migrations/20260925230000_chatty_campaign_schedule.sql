-- Explicit, durable schedule semantics for campaign sequences.
alter table public.chatty_campaigns
  add column if not exists schedule_config jsonb not null default '{"cadence":"once","timezone":"UTC"}'::jsonb;
