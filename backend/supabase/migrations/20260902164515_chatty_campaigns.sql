-- Real backend for the Developer API's campaign tools (app/services/
-- mcp_campaign_service.py). "Campaigns" in the dashboard today is a
-- purely client-side, localStorage-only popup-trigger feature (chatty's
-- campaigns-ui.tsx) with no server persistence at all — this table gives
-- the Developer API/MCP path a genuine, separate, server-persisted
-- campaign store rather than pretending to write to a table that never
-- existed (the previous version of these tools inserted into a
-- nonexistent chatty_campaigns table and silently returned a fabricated
-- "mock-campaign-1" row when the insert failed).
--
-- impressions/clicks/conversions start at 0 and stay there honestly:
-- there is no event-recording pipeline yet (the widget doesn't call any
-- endpoint to report an impression/click/conversion) — building that is
-- a real, separate feature (widget-side instrumentation + an ingest
-- endpoint), not something to fake with plausible-looking numbers.
create table if not exists chatty_campaigns (
    id             uuid primary key default gen_random_uuid(),
    bot_id         uuid not null references chatty_bots(id) on delete cascade,
    name           text not null,
    type           text not null default 'chat_bubble',
    message        text not null,
    url_patterns   text[] not null default '{}',
    trigger_type   text not null default 'time_on_page',
    trigger_value  integer not null default 5,
    target_devices text[] not null default '{desktop,mobile}',
    start_date     timestamptz,
    end_date       timestamptz,
    is_active      boolean not null default true,
    impressions    bigint not null default 0,
    clicks         bigint not null default 0,
    conversions    bigint not null default 0,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_chatty_campaigns_bot_id on chatty_campaigns(bot_id);

alter table chatty_campaigns enable row level security;

-- Same ownership pattern as chatty_csat_feedback/chatty_audit_logs: only
-- the bot's owner (auth.uid() = chatty_bots.user_id) can read/write.
-- Access from this backend goes through the service-role key (bypasses
-- RLS) exactly like every other chatty_* table this API touches.
create policy "Owners manage campaigns for their bots" on chatty_campaigns
  for all to authenticated
  using (
    exists (
      select 1 from chatty_bots
      where chatty_bots.id = chatty_campaigns.bot_id
        and chatty_bots.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from chatty_bots
      where chatty_bots.id = chatty_campaigns.bot_id
        and chatty_bots.user_id = auth.uid()
    )
  );
