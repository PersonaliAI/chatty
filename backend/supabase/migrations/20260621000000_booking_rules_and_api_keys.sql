-- Editable booking rules (per bot) + public API keys. Idempotent.
-- Folded in from the ad-hoc sql/2026-06-21_booking_rules_and_api_keys.sql
-- script as a properly dated migration — chatty_api_keys must exist before
-- 20260707000000_chatty_api_security.sql, which ALTERs it.

alter table public.chatty_bots add column if not exists business_hours_start int default 9;
alter table public.chatty_bots add column if not exists business_hours_end int default 17;
alter table public.chatty_bots add column if not exists working_days jsonb default '["mon","tue","wed","thu","fri"]'::jsonb;
alter table public.chatty_bots add column if not exists buffer_minutes int default 0;
alter table public.chatty_bots add column if not exists advance_notice_hours int default 0;

create table if not exists public.chatty_api_keys (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid references public.chatty_bots(id) on delete cascade,
  user_id uuid not null,
  name text,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  request_count bigint default 0,
  revoked boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_chatty_api_keys_hash on public.chatty_api_keys(key_hash);
create index if not exists idx_chatty_api_keys_bot on public.chatty_api_keys(bot_id);
