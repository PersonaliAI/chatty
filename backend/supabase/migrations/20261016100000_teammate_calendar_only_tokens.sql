-- Add token columns to chatty_team_members for strictly calendar-only OAuth integrations
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS microsoft_token_expiry TIMESTAMPTZ;

-- Ensure RLS is active on chatty_team_members and member self-service update policy exists
ALTER TABLE chatty_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage their own profile and calendar" ON chatty_team_members;
CREATE POLICY "Members manage their own profile and calendar" ON chatty_team_members
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));
