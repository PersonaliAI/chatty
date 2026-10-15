-- Standardize team roles and add personal calendar connection tracking
ALTER TABLE chatty_team_members DROP CONSTRAINT IF EXISTS chatty_team_members_role_check;
ALTER TABLE chatty_team_members ADD CONSTRAINT chatty_team_members_role_check 
  CHECK (role IN ('owner', 'admin', 'agent', 'editor', 'billing_manager', 'viewer'));

-- Add columns for team member personal calendar and meeting links
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS google_email TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS microsoft_calendar_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS microsoft_email TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS zoom_meeting_link TEXT;
ALTER TABLE chatty_team_members ADD COLUMN IF NOT EXISTS calendar_connect_token TEXT;
