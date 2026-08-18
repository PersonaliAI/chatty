-- Migration: allowed_domains and notification_emails were also added to
-- chatty_bots directly in production, outside any migration file (same
-- schema-drift pattern as chatty_sessions/chatty_api_keys/logo_url/
-- avatar_url before them). Surfaced as PGRST204 "column not found" on the
-- dashboard's main Save Changes handler.
ALTER TABLE chatty_bots
  ADD COLUMN IF NOT EXISTS allowed_domains text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notification_emails text;
