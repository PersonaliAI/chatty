-- Migration: Bot isolation & multi-bot sharing
-- 1. Drop mandatory primary calendar default on chatty_bots
ALTER TABLE chatty_bots ALTER COLUMN google_calendar_id DROP NOT NULL;
ALTER TABLE chatty_bots ALTER COLUMN google_calendar_id DROP DEFAULT;
ALTER TABLE chatty_bots ALTER COLUMN google_calendar_id SET DEFAULT NULL;

-- 2. Add per-bot agent profile and sharing link columns
ALTER TABLE chatty_bots 
  ADD COLUMN IF NOT EXISTS agent_display_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS agent_role_title TEXT,
  ADD COLUMN IF NOT EXISTS team_source_bot_id UUID REFERENCES chatty_bots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calendar_source_bot_id UUID REFERENCES chatty_bots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS microsoft_connected_account_id UUID,
  ADD COLUMN IF NOT EXISTS microsoft_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS microsoft_calendar_name TEXT;

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_chatty_bots_team_source ON chatty_bots(team_source_bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_bots_calendar_source ON chatty_bots(calendar_source_bot_id);
