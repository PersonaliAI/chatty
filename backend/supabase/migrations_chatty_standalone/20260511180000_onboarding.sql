-- Onboarding flow: collect display name, timezone, country, terms acceptance.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT FALSE;

-- Mark existing accounts as onboarded so we don't force them through it
UPDATE users
SET onboarding_completed = TRUE
WHERE created_at < NOW()
  AND onboarding_completed IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_completed);
