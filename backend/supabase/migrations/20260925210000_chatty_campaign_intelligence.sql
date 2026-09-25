-- Durable campaign intelligence configuration. Defaults preserve existing campaigns.
alter table public.chatty_campaigns
  add column if not exists audience_rules jsonb not null default '{}'::jsonb,
  add column if not exists channels text[] not null default '{web}'::text[],
  add column if not exists sequence_steps jsonb not null default '[]'::jsonb,
  add column if not exists safety_config jsonb not null default '{"frequency_cap_hours": 24, "require_consent": true}'::jsonb;

create index if not exists chatty_campaigns_channels_idx
  on public.chatty_campaigns using gin(channels);
