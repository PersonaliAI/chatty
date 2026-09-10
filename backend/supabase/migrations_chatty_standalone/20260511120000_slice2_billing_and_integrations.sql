-- Slice 2: subscription state.

-- 1. Subscription tracking on users (lemon_customer_id / lemon_subscription_id already exist)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS google_email TEXT,
  ADD COLUMN IF NOT EXISTS google_scopes TEXT;

-- 2. updated_at maintained by a trigger.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Helpful index for billing lookups
CREATE INDEX IF NOT EXISTS idx_users_lemon_customer ON users(lemon_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_lemon_subscription ON users(lemon_subscription_id);
