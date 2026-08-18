-- Slice 2: subscription state, webhook idempotency, integration metadata.

-- 1. Subscription tracking on users (lemon_customer_id / lemon_subscription_id already exist)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS google_email TEXT,
  ADD COLUMN IF NOT EXISTS google_scopes TEXT;

-- 2. Webhook idempotency — Lemon Squeezy can retry; we dedupe on event_id.
CREATE TABLE IF NOT EXISTS lemon_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT,
  raw JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure tasks/contacts have updated_at maintained by a trigger so settings
--    pages can show "last edited" reliably.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Helpful index for billing lookups
CREATE INDEX IF NOT EXISTS idx_users_lemon_customer ON users(lemon_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_lemon_subscription ON users(lemon_subscription_id);
