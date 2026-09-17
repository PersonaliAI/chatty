-- Migration: Add sender_name and sender_avatar to chatty_conversations,
-- avatar_url to chatty_team_members, and assigned_agent_avatar to chatty_sessions.

ALTER TABLE chatty_conversations
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_avatar text;

ALTER TABLE chatty_team_members
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE chatty_sessions
  ADD COLUMN IF NOT EXISTS assigned_agent_avatar text;
