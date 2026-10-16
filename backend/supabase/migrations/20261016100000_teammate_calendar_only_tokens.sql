-- Add token columns to chatty_team_members for strictly calendar-only OAuth integrations
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS microsoft_token_expiry TIMESTAMPTZ;
