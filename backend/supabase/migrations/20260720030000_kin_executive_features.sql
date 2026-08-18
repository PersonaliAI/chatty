-- Closes the gap found in the 2026-07-20 pricing audit: Executive ($59)
-- advertised "custom webhooks & APIs", "dedicated account manager", and
-- "quarterly prompt tuning" with nothing behind them in the backend, and no
-- table tracked actual token cost per message (only a monthly message-count
-- quota, which is a cost proxy, not a measurement).

-- ---------------------------------------------------------------------------
-- Token-level usage tracking (real cost-per-user measurement)
-- ---------------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS prompt_tokens INT NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS completion_tokens INT NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS total_tokens INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_messages_user_created_tokens
    ON messages(user_id, created_at) WHERE total_tokens > 0;

-- ---------------------------------------------------------------------------
-- Dedicated account manager (Executive) — assigned by an internal admin call
-- (no admin UI exists yet); falls back to a shared support contact via env
-- vars (EXECUTIVE_SUPPORT_NAME/EMAIL/CALENDLY_URL) when unset per-user, so
-- an Executive customer never sees an empty card.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_manager_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_manager_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_manager_calendly_url TEXT;

-- ---------------------------------------------------------------------------
-- Quarterly prompt tuning (Executive) — cooldown tracked per user.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_prompt_tuning_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Custom API keys (Executive) — same shape/hashing scheme as chatty_api_keys,
-- scoped to a Kin user instead of a Chatty bot.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kin_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'API key',
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL, -- first chars only, shown in the UI list view
    revoked BOOLEAN NOT NULL DEFAULT false,
    request_count INT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kin_api_keys_user ON kin_api_keys(user_id);

ALTER TABLE kin_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own Kin API keys" ON kin_api_keys;
CREATE POLICY "Users manage their own Kin API keys" ON kin_api_keys
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Webhooks (Executive) — mirrors the chatty_webhooks/chatty_webhook_deliveries
-- pattern from 20260720000000_chatty_webhooks.sql, scoped to a Kin user.
-- Single-attempt delivery (logged, not retried) — see kin_webhooks_dispatch()
-- in main.py; a durable retry queue was judged out of scope for a first cut.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kin_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    secret TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kin_webhooks_user ON kin_webhooks(user_id);

CREATE TABLE IF NOT EXISTS kin_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES kin_webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | delivered | failed
    response_code INT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_kin_webhook_deliveries_webhook ON kin_webhook_deliveries(webhook_id);

ALTER TABLE kin_webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own Kin webhooks" ON kin_webhooks;
CREATE POLICY "Users manage their own Kin webhooks" ON kin_webhooks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Deliveries are written by the backend's service-role key only (surfaced to
-- the owner read-only via a backend endpoint, not queried directly).
ALTER TABLE kin_webhook_deliveries ENABLE ROW LEVEL SECURITY;
