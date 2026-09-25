-- Durable campaign telemetry. Raw events are retained so analytics can be
-- recomputed and idempotent widget retries cannot inflate counters.
create table if not exists public.chatty_campaign_events (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.chatty_bots(id) on delete cascade,
  campaign_id uuid not null references public.chatty_campaigns(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'click', 'conversion')),
  session_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chatty_campaign_events_campaign_idx
  on public.chatty_campaign_events(campaign_id, created_at desc);
create index if not exists chatty_campaign_events_bot_idx
  on public.chatty_campaign_events(bot_id, created_at desc);
create unique index if not exists chatty_campaign_events_idempotency_idx
  on public.chatty_campaign_events(bot_id, idempotency_key)
  where idempotency_key is not null;
alter table public.chatty_campaign_events enable row level security;
create policy "Owners read campaign events" on public.chatty_campaign_events
  for select to authenticated using (
    exists (select 1 from public.chatty_bots b where b.id = chatty_campaign_events.bot_id and b.user_id = auth.uid())
  );
