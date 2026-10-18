-- ── Subscription and Trial Enforcement Migration ─────────────────────────────
-- Ensures users table has trial_started_at and proper indexes for subscription status.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill trial_started_at for existing users who do not have it set
UPDATE users
SET trial_started_at = created_at
WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_trial_started_at ON users(trial_started_at);
