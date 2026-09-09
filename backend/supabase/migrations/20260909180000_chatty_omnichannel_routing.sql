-- Migration: 20260909180000_chatty_omnichannel_routing.sql
-- Pillar 3: Omnichannel Routing, Agent Presence, Capacity Rules & Live Queue (Zendesk Level)

-- 1. Agent Presence Table (Real-time agent availability and workload capacity)
CREATE TABLE IF NOT EXISTS chatty_agent_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  agent_email TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  max_capacity INT NOT NULL DEFAULT 5,
  last_assigned_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chatty_agent_presence_bot ON chatty_agent_presence(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_agent_presence_status ON chatty_agent_presence(bot_id, status);
CREATE INDEX IF NOT EXISTS idx_chatty_agent_presence_assigned ON chatty_agent_presence(bot_id, last_assigned_at);

-- 2. Routing Settings Table (Bot-level routing rules and algorithm)
CREATE TABLE IF NOT EXISTS chatty_routing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE UNIQUE NOT NULL,
  routing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  algorithm TEXT NOT NULL DEFAULT 'spare_capacity' CHECK (algorithm IN ('spare_capacity', 'round_robin')),
  default_capacity INT NOT NULL DEFAULT 5,
  offline_fallback TEXT NOT NULL DEFAULT 'unassigned_queue' CHECK (offline_fallback IN ('unassigned_queue', 'bot_owner', 'ai_pause')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatty_routing_settings_bot ON chatty_routing_settings(bot_id);

-- 3. Row Level Security (RLS)
ALTER TABLE chatty_agent_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatty_routing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manages agent presence" ON chatty_agent_presence;
CREATE POLICY "Team manages agent presence" ON chatty_agent_presence
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id))
  WITH CHECK (chatty_has_bot_access(bot_id));

DROP POLICY IF EXISTS "Team manages routing settings" ON chatty_routing_settings;
CREATE POLICY "Team manages routing settings" ON chatty_routing_settings
  FOR ALL TO authenticated
  USING (chatty_has_bot_access(bot_id))
  WITH CHECK (chatty_has_bot_access(bot_id));
