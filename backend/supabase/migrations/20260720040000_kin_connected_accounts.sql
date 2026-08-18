-- Real version of Pro's "up to 3 connected accounts" claim, which the
-- 2026-07-20 pricing audit found had nothing behind it (Kin only ever
-- supported one Google + one Microsoft account, total, per user).
--
-- Scope: up to 2 EXTRA Google accounts on top of the existing primary
-- (users.google_access_token), for Pro/Executive only — 3 total. Read-only
-- (Gmail + Calendar aggregation via _read_gmail/_read_calendar in
-- agent_tools.py); sending mail, creating events, etc. still act on the
-- primary account. Microsoft multi-account was judged out of scope for
-- this pass — this closes the specific claim that was on the pricing page.
--
-- Column names deliberately mirror users.google_* so the existing
-- _valid_access_token()/_api() token-refresh helpers in
-- google_integrations.py work unchanged against either table (see the
-- `table` parameter added there in the same change).
CREATE TABLE IF NOT EXISTS kin_connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
    label TEXT,
    google_email TEXT,
    google_access_token TEXT NOT NULL,
    google_refresh_token TEXT NOT NULL,
    google_token_expiry TIMESTAMPTZ,
    google_scopes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kin_connected_accounts_user ON kin_connected_accounts(user_id);

ALTER TABLE kin_connected_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own connected accounts" ON kin_connected_accounts;
CREATE POLICY "Users manage their own connected accounts" ON kin_connected_accounts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
