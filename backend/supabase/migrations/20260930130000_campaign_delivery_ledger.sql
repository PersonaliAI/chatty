-- Durable provider delivery state for campaign operations and analytics.
-- The scheduler/worker use the same idempotency key as Redis so retries update
-- one delivery row instead of creating duplicate records.
create table if not exists public.chatty_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.chatty_bots(id) on delete cascade,
  campaign_id uuid not null references public.chatty_campaigns(id) on delete cascade,
  idempotency_key text not null,
  status text not null check (status in ('queued', 'sent', 'failed', 'suppressed')),
  channel text not null,
  recipient_id text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (bot_id, idempotency_key)
);
create index if not exists chatty_campaign_deliveries_campaign_idx
  on public.chatty_campaign_deliveries(campaign_id, updated_at desc);
create index if not exists chatty_campaign_deliveries_status_idx
  on public.chatty_campaign_deliveries(bot_id, status, updated_at desc);
alter table public.chatty_campaign_deliveries enable row level security;
create policy "Owners read campaign deliveries" on public.chatty_campaign_deliveries
  for select to authenticated using (
    exists (select 1 from public.chatty_bots b where b.id = chatty_campaign_deliveries.bot_id and b.user_id = auth.uid())
  );
