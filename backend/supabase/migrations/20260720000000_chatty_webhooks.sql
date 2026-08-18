-- Real webhook system: multiple subscriptions per bot, each with its own
-- signing secret and event-type filter, plus a durable retry queue.
-- Replaces the old single chatty_bots.webhook_url field (kept for backward
-- compat — still fired as a legacy "new_conversation" no-signature webhook
-- by the code, independent of this table).

CREATE TABLE IF NOT EXISTS chatty_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES chatty_bots(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    secret TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chatty_webhooks_bot ON chatty_webhooks(bot_id);

CREATE TABLE IF NOT EXISTS chatty_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES chatty_webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | delivered | failed
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chatty_webhook_deliveries_due
    ON chatty_webhook_deliveries(status, next_attempt_at)
    WHERE status = 'pending';

-- Idle-session detection for the session.ended event (fired by a cron scan,
-- not a direct trigger — nothing tells the backend a visitor walked away).
ALTER TABLE chatty_sessions ADD COLUMN IF NOT EXISTS ended_webhook_fired BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE chatty_webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage webhooks for their bots" ON chatty_webhooks;
CREATE POLICY "Owners manage webhooks for their bots" ON chatty_webhooks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatty_bots
      WHERE chatty_bots.id = chatty_webhooks.bot_id
        AND chatty_bots.user_id = auth.uid()
    )
  );

-- Deliveries are only ever touched by the backend's service-role key
-- (registration/listing goes through chatty_webhooks, not this table
-- directly), so RLS stays enabled with no policy — locked to service role.
ALTER TABLE chatty_webhook_deliveries ENABLE ROW LEVEL SECURITY;
